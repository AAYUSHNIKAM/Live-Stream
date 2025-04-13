from django.urls import path
from . import views
from . import consumers

urlpatterns = [
    path('', views.index, name='index'),
    path('signup/', views.signup_view, name='signup'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('home/', views.home, name='home'),
    path('go-live/', views.go_live, name='go_live'),
    path('stream/<str:stream_key>/', views.stream_view, name='stream_view'),
    path('end-stream/<str:stream_key>/', views.end_stream, name='end_stream'),
    path('live-now/', views.live_now, name='live_now'),
    path('saved-streams/', views.saved_streams, name='saved_streams'),
    path('check-stream-key/', views.check_stream_key, name='check_stream_key'),
]

websocket_urlpatterns = consumers.websocket_urlpatterns