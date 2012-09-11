from django.contrib import admin

from survey.models import Question, Answer, Respondent
 
admin.site.register(Question)
admin.site.register(Answer)
admin.site.register(Respondent)
