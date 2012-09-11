import json
from collections import defaultdict

from django.views.decorators.cache import cache_page
from django.shortcuts import render
from django.http import HttpResponse
from django.db.models import Count

from survey.models import Question, Respondent, Answer

def _get_answer_counts():
    res = []
    for q, question in enumerate(Question.objects.all()):

        choice_counts = []

        if not question.rows:
            columns = [""]
            answer_rows = [0]
        else:
            columns = json.loads(question.rows)
            answer_rows = Answer.objects.filter(question=question).values_list('answer_row', flat=True).distinct()

        # Only show those answers which have more than one response.
        for (row, subq) in zip(answer_rows, columns):
            counts = Answer.objects.filter(
                    question=question,
                    answer_row=row
                ).values('answer').annotate(
                    answer_count=Count('answer')
                ).filter(answer_count__gt=1)

            choices = []
            for count in counts:
                choices.append(count['answer'])
            choice_counts.append({
                'label': subq,
                'choices': choices
            })

        res.append({
            '_id': question.pk, # The django model index
            'index': q, # The row index, starting from 0
            'number': question.index, # The survey's question number.
            'widget': question.widget,
            'question': question.question,
            'subquestions': choice_counts,
        })
    return res

# Cache basically forever.  10 years.
@cache_page(60 * 60 * 24 * 365 * 10)
def questions_json(request):
    response = HttpResponse(json.dumps(_get_answer_counts(), indent=1))
    response['Content-type'] = "application/json"
    return response

# Cache basically forever.  10 years.
@cache_page(60 * 60 * 24 * 365 * 10)
def answers_json(request):
    # Indexed answer rows for facets.
    counts = _get_answer_counts()
    responses = []
    answer_index = defaultdict(lambda: defaultdict(dict))
    for answer in Answer.objects.all():
        answer_index[answer.question_id][answer.respondent_id][answer.answer_row] = answer

    for respondent in Respondent.objects.all():
        response = []
        for question in counts:
            subq_answers = []
            for subq in range(len(question['subquestions'])):
                allowed_answers = question['subquestions'][subq]['choices']
                try:
                    answer = answer_index[question['_id']][respondent.id][subq]
                    subq_answers.append(allowed_answers.index(answer.answer))
                except (KeyError, ValueError):
                    subq_answers.append(-1)
            response.append(subq_answers)
        responses.append(response)
    response = HttpResponse(json.dumps(responses, separators=(',',':')))
    response['Content-type'] = "application/json"
    return response

def facets(request):
    return render(request, "facets.html")
