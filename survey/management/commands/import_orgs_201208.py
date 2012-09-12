import re
import csv
import json

from django.core.management import BaseCommand
from django.db import transaction

from survey.models import Question, Answer, Respondent

column_maps = {
    'q0007': {
        'question': "How did you find this survey?",
        'widget': 'choice_list',
        'rows': ['Choices', 'Other'],
    },
    'q0008': {
        'question': "Have you ever been to an Occupy camp?",
        'widget': 'geo',
        # Ugh.  This is a one-of-a-kind question for this survey -- it ought to
        # be a unordered 'set'; every other question is ordered.  For
        # simplicity (but incorrectly), handle the conglomeration of these
        # responses in the frontend.
        "rows": [
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'
        ],
    },
    'q0009': {
        'question': "Please describe how frequently you have been to a camp.  Choose only one answer:",
        'widget': 'pie',
    },
    'q0010': {
        'question': "In your visits to the Occupy camp, you have: (Select all that apply)",
        'widget': 'bar_chart',
        'rows': [
            "Slept in an Occupy camp",
            "Attended a General Assembly",
            "Taken part in a Working Group",
            "Volunteered to provide food or services to people at the camp",
            "Participated in workshops or events hosted at teh camp",
            "Marched in a protest",
            "Organized an event or action",
            "Got arrested",
            "done something else that isn't listed",
            "Other",
        ]
    },
    'q0011': {
        'question': "Have you participated in any of the following activities related to the Occupy movement?  Select all that apply.",
        'widget': 'bar_chart',
        'rows': [
            'None of these',
            'Face to face discussions',
            'Wrote a blog post',
            'Made a video',
            'Donated money, food, or goods',
            'Signed a petition',
            'Marched in a protest',
            'Organized an event or action',
            'Got arrested',
            'Made phone calls to elected officials',
            'Other',
        ],
    },
    'q0012': {
        'question': "Would you consider the Occupy movement to be the first movement you have participated in?",
        'widget': 'pie',
    },
    'q0013': {
        'question': "Do you participate in any of the following",
        'widget': 'matrix',
        'rows': [
            'Political Party',
            'Labor Union',
            'Nonprofit Organization',
            'Church or Religious Organization',
            'Non-Government Organization',
            'Affinity Group',
            'Social justice organization',
            'Worker Center',
            "Cultural Groups",
            "Sports groups or teams",
            "Another voluntary association",
            "Professional Association",
            "Business Association",
        ],
    },
    'q0014': {
        'question': "Here are some different forms of political and social action people can take.  Please indicate, for each one, if you have done this:",
        'widget': 'matrix',
        'rows': [
            'Signed a petition',
            'Boycotted, or deliberately bought, certain products for political, ethical, or environmental reasons',
            'Took part in a demonstration',
            'Attended a political meeting or rally',
            'Contacted, or attempted to contact, a politician or a civil servant to express your views',
            'Donated money or raised funds for a social or political activity',
            'Contacted or appeared in the media to express your views',
            'Joined an Internet political forum or discussion group',
            'Other',
        ],
    },
    'q0015': {
        'question': "These are some sources that you might or might not use for news and information about the Occupy movement.  Please indicate whether you used these sources for news and information about the Occupy movement.",
        'widget': 'matrix',
        'rows': [
            'Word of mouth',
            'Discussions at Occupy camps or face to face',
            #'groups',
            'email',
            'twitter',
            'facebook',
            'chat rooms / IRC',
            'YouTube',
            'Tumblr',
            'Blogs',
            'Local Newspaper',
            'National or international newspaper',
            'Local radio',
            'National or international radio',
            'Local television',
            'National or international television',
            'Livestreaming video site',
            'Websites of the Occupy Movement',
            'Other',
        ],
    },
    'q0016': {
        'question': "If you participate in the Occupy movement, what TOP THREE concerns motivate you TO PARTICIPATE?  Please use single words if possible, and list them in order of importance.",
        'widget': 'choice_list',
        'rows': [
            'first',
            'second',
            'third',
        ],
    },
    'q0017': {
        'question': "If you do not participate in the Occupy movement, what TOP THREE reasons explain why you HAVE NOT PARTICIPATED?  Please use single words if possible, and list them in order of importance.",
        'widget': 'choice_list',
        'rows': [
            'first',
            'second',
            'third',
        ],
    },
    'q0018_0001YYYY': {
        'question': "What year were you born?",
        'widget': 'bar_chart',
    },
    'q0019': {
        'question': "Your gender (check all that apply)",
        'widget': 'choice_list',
        'rows': [
            'Female',
            'Male',
            'Transgender',
            'Decline to state',
            'Other',
        ],
    },
    'q0020': {
        'question': "Your sexual identity (check all that apply)",
        'widget': 'choice_list',
        'rows': [
            'Lesbian/Gay/Bisexual/Queer',
            'Heterosexual/Straight',
            'Decline to state',
            'Other',
        ],
    },
    'q0021': {
        'question': "What best describes your employment status during the last month?  (check all that apply)",
        'widget': 'choice_list',
        'rows': [
            "Student",
            "Employed full-time",
            "Part-time",
            "Self-employed",
            "Full-time homemaker",
            "Seasonal",
            "Under-employed",
            "Unemployed",
            "Disabled",
            "Armed services (active service)",
            "Veteran",
            "Retired",
            "Other status",
        ]
    },
    'q0022': {
        'question': "What best describes your present housing status?",
        'widget': 'choice_list',
        "rows": [
            "Housing status",
            "Other",
        ]
    },
    'q0023': {
        'question': "What is your marital status?",
        'widget': 'choice_list',
        'rows': ['Choices', 'Other']
    },
    'q0024': {
        'question': "How many people do you support with your income?",
        'widget': 'matrix',
        'rows': ['Number of children under 18?', 'Number of adults you support?'],
    },
    'q0025': {
        'question': "Do you identify as:",
        'widget': 'choice_list',
        'rows': ['Choices', 'Other']

    },
    'q0026': {
        'question': "Do you live in the US?  If you are living elsewhere temporarily, select Yes.",
        'widget': 'pie',
    },
    'q0028': {
        'question': "How many years of education have you completed?",
        'widget': 'choice_list',
    },

    'q0030': {
        'question': "Describe your race or ethnicity.",
        'widget': 'choice_list',
    },
    'q0031': {
        'question': "Which political party do you identify with most closely?",
        'rows': ["I do or don't associate", "Political party"],
        'widget': 'matrix',
    },
    'q0032': {
         'question': "Voting activity: Did you vote in your most recent nationwide election?",
         'rows': ["Eligibility", "Voted for"],
         'widget': 'matrix',
     },
    'q0033': {
         'question': "Do you plan to vote in your next nationwide election?",
         'rows': ['Intention to vote', "Voting for"],
         'widget': 'matrix',
     },
    'q0034': {
         'question': "What is your five-digit zip code?",
         'widget': 'geo',
     },
    'q0035': {
         'question': "What is your annual household income in U.S. dollars?",
         'widget': 'choice_list',
     },
    'q0036': {
         'question': "Your race/ethnicity (check all that apply)",
         'widget': 'choice_list',
         'rows': [
             'Asian',
             'Black, African, or African-American',
             'Latino/Latina',
             'Native American/Indigenous',
             'Pacific Islander',
             'South Asian',
             'Southeast Asian',
             'Arab, Southwest Asian or North African',
             'Biracial/Multiracial/Mixed race',
             'White/Caucasian',
             'Decline to state',
             'Other',
         ],
     },
    'q0037': {
        'question': "What is the highest level of formal education that you have completed?",
        "widget": "pie",
    },
    'q0038': {
        'question': "Which of the following political parties do you identify with most closely?",
        'widget': 'choice_list',
        'rows': ['Choices', 'Other']
    },
    'q0039': {
         'question': "For whom did you vote in the 2008 presidential election? (check one)",
         "widget": "choice_list",
         "rows": ["Choices", "Other"],
    },
    'q0040': {
        'question': "Do you plan to vote in the 2012 presidential election? (check one)",
        "widget": "pie",
    },
    'q0041': {
        'question': "If you plan to vote, for whom do you expect to vote? (check one)",
        "widget": "choice_list",
        "rows": ["Choices", "Other"],
    },
}

COLUMN_BLACKLIST = ('q0018_0001AGE',)

def load_questions():
    print "Questions..."
    for key, details in column_maps.iteritems():
        rows = details.get('rows', None)
        id_ = int(key[1:5].lstrip('0'))
        question = Question.objects.create(
                id=id_,
                index=id_,
                question=details['question'],
                rows=json.dumps(rows) if rows else '',
                widget=details['widget'],
        )

def clean_answer(q_col, val):
    val = val.replace("&amp;", "&")
    if q_col.startswith("q0007"):
        val = {
                "1": "OccupyTogether.org",
                "2": "Occupyresearch.net",
                "3": "Facebook",
                "4": "Twitter",
                "5": "From a personal contact",
        }.get(val.strip(), val)

    if q_col.startswith("q0023"):
        val = {'0': "Other"}.get(val.strip(), val)

    if q_col.startswith("q0026"):
        val = {"1": "Yes", "2": "No"}.get(val.strip(), val)

    if q_col.startswith("q0031"):
        val = {'0': "I associate with a party"}.get(val.strip(), val)

    if q_col.startswith("q0032"):
        val = {'0': "I voted"}.get(val.strip(), val)

    if q_col.startswith("q0033"):
        val = {'0': "I plant o vote"}.get(val.strip(), val)

    if q_col.startswith("q0034"):
        if val not in ("999", "9999"):
            val = "0" * (5 - len(val)) + val

    return {
            "": "",
            "(blank)": "",
            "no response": "",
            "999": "",
            "9999": "Not applicable",
            "blank": "",
            "i do not identify with any part": "I do not identify with any party",
    }.get(val.strip().lower(), val)

def load_answers(filepath):
    questions = list(Question.objects.all())
    with transaction.commit_manually():
        with open(filepath) as fh:
            reader = csv.reader(fh)
            itr = iter(reader)
            top = itr.next()
            data_rows = list(itr)
            print "Respondents..."
            respondents = [Respondent.objects.create(row_num=i+1) for i in range(len(data_rows))]

            print "Answers..."
            for question in questions:
                q_cols = [c for c in top if c.startswith("q%04i" % question.index)]
                for c, q_col in enumerate(q_cols):
                    if q_col in COLUMN_BLACKLIST:
                        continue
                    for respondent, row in zip(respondents, data_rows):
                        val = dict(zip(top, row))[q_col]
                        val = clean_answer(q_col, val)
                        if val:
                            Answer.objects.create(
                                respondent=respondent,
                                question=question,
                                answer=val,
                                subquestion=c,
                            )
        transaction.commit()

class Command(BaseCommand):
    args = '<csvpath>'
    def handle(self, filepath, *args, **kwargs):
        load_questions()
        load_answers(filepath)
