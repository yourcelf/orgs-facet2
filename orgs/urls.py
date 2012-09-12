from django.conf.urls import patterns, include, url

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

urlpatterns = patterns('',
    # Uncomment the next line to enable the admin:
    url(r'^admin/', include(admin.site.urls)),
    url('questions.json', 'survey.views.questions_json'),
    url('answers.json', 'survey.views.answers_json'),
    url('geocodes.json', 'survey.views.geocodes_json'),
    url('^$', 'survey.views.facets'),
)
