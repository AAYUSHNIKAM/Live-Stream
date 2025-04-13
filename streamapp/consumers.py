import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import LiveStream

class StreamConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.stream_key = self.scope['url_route']['kwargs']['stream_key']
        self.room_group_name = f'stream_{self.stream_key}'
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message_type = text_data_json.get('type')
        
        if message_type == 'offer' or message_type == 'answer' or message_type == 'candidate':
            # Broadcast signaling messages to other clients in the room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'stream_signal',
                    'message': text_data_json
                }
            )
        elif message_type == 'viewer_count':
            # Update viewer count (simplified)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'viewer_count',
                    'count': text_data_json.get('count', 0)
                }
            )

    async def stream_signal(self, event):
        # Send signaling messages to WebSocket
        await self.send(text_data=json.dumps(event['message']))

    async def viewer_count(self, event):
        # Send viewer count updates
        await self.send(text_data=json.dumps({
            'type': 'viewer_count',
            'count': event['count']
        }))

websocket_urlpatterns = []