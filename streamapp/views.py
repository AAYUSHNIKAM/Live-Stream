from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.decorators import login_required
from .models import UserProfile, LiveStream, SavedStream
from .forms import UserProfileForm, StreamForm
import uuid
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.shortcuts import render, redirect

def index(request):
    if request.user.is_authenticated:
        return redirect('home')
    return render(request, 'streamapp/index.html')

def signup_view(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            UserProfile.objects.create(user=user)
            login(request, user)
            return redirect('home')
    else:
        form = UserCreationForm()
    return render(request, 'streamapp/signup.html', {'form': form})

def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('home')
    else:
        form = AuthenticationForm()
    return render(request, 'streamapp/login.html', {'form': form})

@login_required
def logout_view(request):
    logout(request)
    return redirect('index')

@login_required
def home(request):
    user_profile = UserProfile.objects.get(user=request.user)
    live_streams = LiveStream.objects.filter(is_live=True)
    saved_streams = SavedStream.objects.filter(saved_by=request.user)
    
    if request.method == 'POST':
        profile_form = UserProfileForm(request.POST, request.FILES, instance=user_profile)
        if profile_form.is_valid():
            profile_form.save()
            return redirect('home')
    else:
        profile_form = UserProfileForm(instance=user_profile)
    
    return render(request, 'streamapp/home.html', {
        'profile_form': profile_form,
        'live_streams': live_streams,
        'saved_streams': saved_streams,
    })

@login_required
def go_live(request):
    if request.method == 'POST':
        form = StreamForm(request.POST)
        if form.is_valid():
            stream = form.save(commit=False)
            stream.user = request.user
            stream.stream_key = str(uuid.uuid4())
            stream.is_live = True
            stream.save()
            return redirect('stream_view', stream_key=stream.stream_key)
    else:
        form = StreamForm()
    return render(request, 'streamapp/go_live.html', {'form': form})

@login_required
def stream_view(request, stream_key):
    try:
        stream = LiveStream.objects.get(stream_key=stream_key)
        is_owner = (request.user == stream.user)
        return render(request, 'streamapp/stream_view.html', {
            'stream': stream,
            'is_owner': is_owner,
            'stream_key': stream_key,
        })
    except LiveStream.DoesNotExist:
        return redirect('home')

@login_required
def end_stream(request, stream_key):
    if request.method == 'POST':
        try:
            stream = LiveStream.objects.get(stream_key=stream_key, user=request.user)
            stream.is_live = False
            stream.end_time = timezone.now()
            stream.save()
            
            if 'save_stream' in request.POST:
                # In a real app, you'd save the actual stream content here
                saved_stream = SavedStream.objects.create(
                    live_stream=stream,
                    saved_by=request.user
                )
            return redirect('home')
        except LiveStream.DoesNotExist:
            pass
    return redirect('home')

@login_required
def live_now(request):
    live_streams = LiveStream.objects.filter(is_live=True)
    return render(request, 'streamapp/live_now.html', {'live_streams': live_streams})

@login_required
def saved_streams(request):
    saved_streams = SavedStream.objects.filter(saved_by=request.user)
    return render(request, 'streamapp/saved_streams.html', {'saved_streams': saved_streams})

@csrf_exempt
@login_required
def check_stream_key(request):
    if request.method == 'POST':
        stream_key = request.POST.get('stream_key')
        exists = LiveStream.objects.filter(stream_key=stream_key, is_live=True).exists()
        return JsonResponse({'exists': exists})
    return JsonResponse({'error': 'Invalid request'}, status=400)