from django.db import models
from django.db.models import Count

class Respondent(models.Model):
    row_num = models.IntegerField(default=0)

    def __unicode__(self):
        return "Row %s" % self.row_num

class Question(models.Model):
    question = models.TextField()
    index = models.IntegerField(unique=True)
    rows = models.TextField(
            help_text="JSON Array of question rows, if any.",
            blank=True)
    widget = models.CharField(max_length=20)

    class Meta:
        ordering = ['index']

    def __unicode__(self):
        return self.question

class Answer(models.Model):
    respondent = models.ForeignKey(Respondent)
    question = models.ForeignKey(Question)
    answer = models.TextField(blank=True)
    subquestion = models.IntegerField(default=0)

    class Meta:
        ordering = ['question', 'subquestion']

    def __unicode__(self):
        return self.answer

class Geocode(models.Model):
    term = models.CharField(max_length=50)
    lat = models.FloatField()
    lng = models.FloatField()
    state = models.CharField(max_length=2, blank=True)

    def __unicode__(self):
        return self.term

class USState(models.Model):
    term = models.CharField(max_length=50)
    state = models.CharField(max_length=2, blank=True)

    class Meta:
        unique_together = (('term', 'state'),)
