import json
from collections import defaultdict

from django.views.decorators.cache import cache_page
from django.shortcuts import render
from django.http import HttpResponse
from django.db.models import Count

from survey.models import Question, Respondent, Answer

def _get_answer_counts():
    res = []
    for q in Question.objects.all():

        choice_counts = []

        if not q.rows:
            columns = [""]
            answer_rows = [0]
        else:
            columns = json.loads(q.rows)
            answer_rows = Answer.objects.filter(question=q).values_list('answer_row', flat=True).distinct()

        # Only show those answers which have more than one response.
        for (row, subq) in zip(answer_rows, columns):
            counts = Answer.objects.filter(
                    question=q,
                    answer_row=row
                ).values('answer').annotate(
                    answer_count=Count('answer')
                ).filter(answer_count__gt=1)

            subq_counts = []
            for count in counts:
                subq_counts.append([count['answer'], count['answer_count']])
            choice_counts.append([subq, subq_counts])

        res.append({
            '_id': q.id,
            'index': q.index,
            'widget': q.widget,
            'question': q.question,
            'choices': choice_counts,
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
            for answer_row in range(len(question['choices'])):
                allowed_answers = [
                    w for w, c in question['choices'][answer_row][1]
                ]
                try:
                    answer = answer_index[question['_id']][respondent.id][answer_row]
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
