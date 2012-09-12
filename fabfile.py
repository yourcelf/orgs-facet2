import os
import time
import signal
import subprocess
from fabric.api import *
"""
This is a simple build script to deploy this app as a static html site.

To use: 
    1. Install fabric: http://fabfile.org
    2. With node 0.6.x and all dependencies all set up, run:

        $ fab deploy -H example.com

    ... where example.com is the destination server.  This will place the files
    in the directory /sites/time.byconsens.us/.  To change this, run:

        $ fab deploy:dest="/var/www/somedir" -H example.com

    Set the username for the remote server with "--user", defaults to your
    current logged in username.

The script operates by starting node in production mode, spidering the site
with wget, and deploying with rsync.  As a bonus, it builds an appcache
manifest file for offline use.
"""

BUILD_DIR = os.path.join(os.path.dirname(__file__), "_build")

def build():
    # Spider the site.
    with settings(warn_only=True):
        local("rm -r \"%s\"" % BUILD_DIR)
    local("mkdir -p %s" % BUILD_DIR)
    with lcd(BUILD_DIR):
        local("wget -nH --mirror --page-requisites http://localhost:8000 http://localhost:8000/questions.json http://localhost:8000/answers.json http://localhost:8000/geocodes.json")


def deploy(dest='/sites/orgs-facet2.tirl.org/'):
    # Deploy with rsync.
    local("rsync -az --delete %s %s@%s:%s" % (
        BUILD_DIR.rstrip("/") + "/",
        env.user,
        env.host,
        dest.rstrip("/") + "/",
    ))
