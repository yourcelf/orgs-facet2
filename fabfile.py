import os
import time
import signal
import subprocess
from fabric.api import *

BASE = os.path.dirname(os.path.abspath(__file__)).rstrip("/")
BUILD_DIR = os.path.join(BASE, "_build")

def init():
    local("python manage.py syncdb --noinput")
    local("python manage.py reset survey --noinput")
    local("python manage.py loaddata %s/survey/fixtures/usstates.json" % BASE)
    local("python manage.py import_orgs_201208 %s/data/OccupySurvey8.28.csv" % BASE)

def build():
    # Spider the site.
    """
    Start the dev server on port 8000 (default), and then run this.
    """
    with settings(warn_only=True):
        local("rm -r \"%s\"" % BUILD_DIR)
    local("mkdir -p %s" % BUILD_DIR)
    with lcd(BUILD_DIR):
        local("wget -nH --mirror --page-requisites http://localhost:8000 http://localhost:8000/questions.json http://localhost:8000/answers.json localhost:8000/static/img/Blank_US_Map.svg")


def deploy(dest='/sites/orgs-facet2.tirl.org/'):
    # Deploy with rsync.
    local("rsync -az --delete %s %s@%s:%s" % (
        BUILD_DIR.rstrip("/") + "/",
        env.user,
        env.host,
        dest.rstrip("/") + "/",
    ))
