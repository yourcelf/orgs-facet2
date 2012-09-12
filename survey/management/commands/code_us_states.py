from django.core.management.base import BaseCommand
from django.contrib.localflavor.us.us_states import STATES_NORMALIZED

from survey.models import USState, Answer

blacklist = set([
    "0000",
    "00000",
    "00474",
    "02395",
    "02752",
    "100276",
    "11111",
    "137608",
    "63991",
    "884042",
    "937920",
    "99990",
])


class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        values = Answer.objects.filter(question__widget='geo').values_list('answer', flat=True).distinct()
        for value in values:
            if not USState.objects.filter(term=value).exists():
                while True:
                    print value
                    state = raw_input("> ")
                    print [state]
                    if state != "":
                        try:
                            state = STATES_NORMALIZED[state.strip().lower()]
                        except KeyError:
                            print "Unrecognized state."
                            continue
                    obj = USState.objects.create(term=value, state=state)
                    print "Added", obj.pk
                    break
