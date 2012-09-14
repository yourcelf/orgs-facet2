import json
from collections import defaultdict

from django.views.decorators.cache import cache_page
from django.shortcuts import render
from django.http import HttpResponse
from django.db.models import Count

from survey.models import Question, Respondent, Answer, USState

def _get_states():
    geo_states = {}
    for stateobj in USState.objects.all():
        geo_states[stateobj.term] = stateobj.state
    return geo_states

def _get_question_choices():
    res = []

    geo_states = _get_states()

    for q, question in enumerate(Question.objects.all()):
        choices = []

        if not question.rows:
            columns = [""]
            subquestions = [0]
        else:
            columns = json.loads(question.rows)
            subquestions = Answer.objects.filter(question=question).values_list('subquestion', flat=True).distinct()

        #HACK: Munge geo queries to generalize to "State" values, and collapse
        # all subquestions.
        if question.widget == "geo":
            geo_counts = defaultdict(int)
            respondents = set()
            for (subq, label) in zip(subquestions, columns):
                answers = Answer.objects.filter(question=question, subquestion=subq)
                for answer in answers:
                    state = geo_states.get(answer.answer, answer.answer) 
                    if not state:
                        state = answer.answer
                    # Only take one response from each respondent...
                    if answer.respondent_id not in respondents:
                        geo_counts[state] += 1
                    respondents.add(answer.respondent_id)

            choices = [{
                "label": "",
                "choices": [k for (k,v) in geo_counts.items() if v > 1],
            }]
        else:

            # Only show those answers which have more than one response.
            for (subq, label) in zip(subquestions, columns):
                answers = Answer.objects.filter(
                        question=question,
                        subquestion=subq
                    ).values('answer').annotate(
                        answer_count=Count('answer')
                    ).filter(answer_count__gt=1)

                subchoices = []
                for answer in answers:
                    subchoices.append(answer['answer'])
                choices.append({
                    'label': label,
                    'choices': subchoices
                })

        res.append({
            '_id': question.pk, # The django model index
            'index': q, # The row index, starting from 0
            'number': question.index, # The survey's question number.
            'widget': question.widget,
            'question': question.question,
            'subquestions': choices,
        })
    return res

# Cache basically forever.  10 years.
@cache_page(60 * 60 * 24 * 365 * 10)
def questions_json(request):
    response = HttpResponse(json.dumps(_get_question_choices(), indent=1))
    response['Content-type'] = "application/json"
    return response

# Cache basically forever.  10 years.
@cache_page(60 * 60 * 24 * 365 * 10)
def answers_json(request):
    # Indexed answer rows for facets.
    question_choices = _get_question_choices()
    geo_states = _get_states()
    # Speed things up by pre-sorting answers into:
    # {question_id: {respondent_id: {subquestion: Answer}}}
    answer_index = defaultdict(lambda: defaultdict(dict))
    for answer in Answer.objects.all():
        answer_index[answer.question_id][answer.respondent_id][answer.subquestion] = answer

    responses = []
    for respondent in Respondent.objects.all():
        response = []
        for question in question_choices:
            subq_answers = []

            # HACK: flatten geo types into geocoded state values.
            if question['widget'] == 'geo':
                allowed_answers = question['subquestions'][0]['choices']
                for subq, answer in answer_index[question['_id']][respondent.id].items():
                    state = geo_states.get(answer.answer, answer.answer)
                    if not state:
                        state = answer.answer
                    try:
                        subq_answers.append(allowed_answers.index(state))
                    except (KeyError, ValueError):
                        continue
                    break
                else:
                    subq_answers.append(-1)
            else:
                for subq in range(len(question['subquestions'])):
                    allowed_answers = question['subquestions'][subq]['choices']
                    try:
                        answer = answer_index[question['_id']][respondent.id][subq]
                        subq_answers.append(allowed_answers.index(answer.answer))
                    except (KeyError, ValueError):
                        subq_answers.append(-1)

            response.append(subq_answers)
        responses.append(response)
    json_text = json.dumps(responses, separators=(',',':'))
    #json_text = json.dumps(responses, indent=1)
    response = HttpResponse(json_text)
    response['Content-type'] = "application/json"
    return response

def facets(request):
    return render(request, "facets.html")
