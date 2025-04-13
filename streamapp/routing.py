from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/stream/(?P<stream_key>[a-f0-9\-]+)/$', consumers.StreamConsumer.as_asgi()),
]
