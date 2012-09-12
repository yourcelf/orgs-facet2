import os
import re
import csv
import time
import json
import urllib2
import pprint
from cStringIO import StringIO

from django.core.management.base import BaseCommand
from django.contrib.localflavor.us.us_states import STATES_NORMALIZED
from django.conf import settings

from survey.models import Answer, Geocode

CACHE = os.path.join(settings.BASE, 'CACHE')
if not os.path.exists(CACHE):
    os.makedirs(CACHE)

def escape_url_name(url):
    return 

def get_cached_url(url):
    fname = os.path.join(CACHE, re.sub("[^a-zA-Z0-9_.]", "-", url))
    if os.path.exists(fname):
        with open(fname) as fh:
            return fh.read()
    else:
        print "GET", url
        url = urllib2.urlopen(url)
        contents = url.read()
        #time.sleep(2)
        with open(fname, 'w') as fh:
            fh.write(contents)
        return contents

blacklist = [
    "Not applicable", "00000", "63991", "00009", "11111", "99990", "00474", "02395", "02752",
]

query_substitution = {
    'Ithica_NY': 'city:Ithica;state:NY',
    'Charleston_SC': 'city:Charleston;state:SC',
    'Portland_ME': 'city:Portland;state:ME',
    'Orange_County': 'county:Orange%20County;state:CA',
    'Columbia_SC': 'city:Columbia;state:SC',
    'Columbia_MO': 'city:Columbia;state:MO',
    'UM_Duluth': 'city:Duluth;state:MN',
    'Penn_State': 'state:PA',
    'Albany': 'city:Albany;state:NY',
    'Mississippi': 'state:MS',
    'Los_Angeles': 'city:Los%20Angeles;state:CA',
    'Syracuse': 'city:Syracuse;state:NY',
    'Detroit': 'city:Detroit;state:MI',
    'Austin': 'city:Austin;state:TX',
    'New_York': 'city:New%20York;state:NY',
    'Barcelona': 'city:Barcelona;country:Spain',
    'Calgary': 'city:Calgary;country:Canada',
    'Victorya': 'city:Victoria;country:Canada',
    'Humboldt': 'city:Humboldt;state:CA',
    'ME': 'state:ME',
    'Columbia': 'city:Columbia;state:SC',
    'Prescott': 'city:Prescott;state:AZ',
    'San_Diego': 'city:San%20Diego;state:CA',
    'Merced': 'city:Merced;state:CA',
    'Richmond': 'city:Richmond;state:VA',
    'San_Rafael': 'city:San%20Rafael;state:CA',
    "Berkeley": "city:Berkeley;state:CA",
    "Missoula": "city:Missoula;state:MT",
    "Lincoln_City": "city:Lincoln%20City;state:NE",
    'St_Paul': "city:St.%20Paul;state:MN",
    "El_Paso": "city:El%20Paso;state:TX",
    'New_Orleans': "city:New%20Orleans;state:LA",
    "Ames": "city:Ames;state:IA",
    "Berkeley": "city:Berkeley;state:CA",
}

whitelist = {
    'Albany': { 'lat': 42.65117, 'lng': -73.75497, 'state': 'NY' },
    'Mississippi': {'lat': 32.3038, 'lng': -90.18209, 'state': 'MS' },
    'Los_Angeles': {'lat': 34.05029, 'lng': -118.24209, 'state': 'CA' },
    'Syracuse': {'lat': 43.04812, 'lng': -76.14742, 'state': 'NY' },
    'Detroit': {'lat': 42.16479, 'lng': -83.27126, 'state': 'MI' },
}

class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        zips_text = get_cached_url("https://raw.github.com/yourcelf/getzips/master/zips.csv")
        reader = csv.reader(StringIO(zips_text))
        zip_to_state = {}
        for zipcode,city,state in reader:
            zip_to_state[zipcode] = state
            zip_to_state['78721'] = 'TX'
            zip_to_state['14517'] = 'NY'
            zip_to_state['80234'] = 'CO'
            
        qs = Answer.objects.filter(question__widget="geo")
        for term in blacklist:
            qs = qs.exclude(answer=term)
        problems = set()
        no_states = set()
        for answer in qs:
            if answer.answer in whitelist:
                Geocode.objects.get_or_create(**whitelist[answer.answer])
                continue
            if not Geocode.objects.filter(term=answer.answer).exists():
                is_zip = re.match("^\d{5}$", answer.answer)
                if is_zip:
                    query = "zipcode:%s;country:US" % answer.answer
                else:
                    query = query_substitution.get(answer.answer,
                        "city:%s" % (answer.answer.replace("_", "%20"))
                    )
                url = "http://geocoding.cloudmade.com/%s/geocoding/v2/find.js?query=%s" % (settings.CLOUDMADE_API_KEY, query)
                json_text = get_cached_url(url)
                if json_text != "":
                    data = json.loads(json_text)
                else:
                    data = {}
                #print answer.answer, data
                if 'found' in data and data['found'] != 0:
                    feature = data['features'][0]
                    if is_zip:
                        state = zip_to_state[answer.answer]
                    elif 'is_in' in feature['properties'] and feature['properties']['is_in'].endswith("USA"):
                        if "," in feature['properties']['is_in']:
                            state = feature['properties']['is_in'].split(",")[-2]
                        elif " " in feature['properties']['is_in']:
                            state = feature['properties']['is_in'].split(" ")[-2]
                        state = STATES_NORMALIZED.get(state.lower().strip(), "")
                    else:
                        no_states.add(answer.answer)
                        state = ""
                    Geocode.objects.get_or_create(
                        term=answer.answer,
                        lat=feature['centroid']['coordinates'][0],
                        lng=feature['centroid']['coordinates'][1],
                        state=state
                    )
                else:
                    problems.add(answer.answer)
        print "No states"
        pprint.pprint(no_states)
        print "Problems"
        pprint.pprint(problems)
