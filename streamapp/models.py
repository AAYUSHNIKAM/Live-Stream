from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    
    def __str__(self):
        return self.user.username

class LiveStream(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    stream_key = models.CharField(max_length=100, unique=True)
    is_live = models.BooleanField(default=False)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.title}"

class SavedStream(models.Model):
    live_stream = models.ForeignKey(LiveStream, on_delete=models.CASCADE)
    saved_by = models.ForeignKey(User, on_delete=models.CASCADE)
    saved_at = models.DateTimeField(auto_now_add=True)
    video_file = models.FileField(upload_to='saved_streams/', null=True, blank=True)
    
    def __str__(self):
        return f"{self.live_stream.title} saved by {self.saved_by.username}"