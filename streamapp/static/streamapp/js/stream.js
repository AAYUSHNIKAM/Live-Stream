document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const videoElement = document.getElementById('live-video');
    const viewerCountElement = document.getElementById('viewer-count');
    const endStreamBtn = document.getElementById('end-stream-btn');
    const saveOptions = document.getElementById('save-options');
    const endStreamForm = document.getElementById('end-stream-form');
    const statusElement = document.getElementById('stream-status');
    
    // Get configuration from global object
    const config = window.streamConfig;
    let peerConnection = null;
    let socket = null;
    let localStream = null;
    let viewerCount = 0;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    let viewerCountInterval = null;

    // Initialize stream with proper error handling
    try {
        initializeStream();
    } catch (error) {
        console.error("Stream initialization error:", error);
        statusElement.textContent = "Failed to initialize stream";
        statusElement.style.color = "red";
    }

    function initializeStream() {
        // Check WebRTC support
        if (!window.RTCPeerConnection || !navigator.mediaDevices) {
            statusElement.textContent = "WebRTC is not supported in your browser";
            statusElement.style.color = "red";
            return;
        }

        // Initialize WebSocket connection
        initializeWebSocket();

        // Setup stream based on user role
        if (config.isOwner) {
            setupStreamer();
        } else {
            setupViewer();
        }
    }

    function initializeWebSocket() {
        const wsUrl = `${config.wsProtocol}://${config.wsHost}/ws/stream/${config.streamKey}/`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            reconnectAttempts = 0;
            const statusMessage = config.isOwner 
                ? "Streaming started - Waiting for viewers..." 
                : "Connected to stream - Negotiating...";
            statusElement.textContent = statusMessage;
            statusElement.style.color = "green";
            console.log("WebSocket connection established");
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
            statusElement.textContent = "Connection error";
            statusElement.style.color = "red";
            if (!config.isOwner) {
                attemptReconnect();
            }
        };

        socket.onclose = (event) => {
            console.log("WebSocket closed:", event);
            statusElement.textContent = "Connection closed";
            statusElement.style.color = "orange";
            if (!config.isOwner && event.code !== 1000) {
                attemptReconnect();
            }
        };

        socket.onmessage = handleWebSocketMessage;
    }

    function handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'viewer_count') {
                viewerCount = data.count;
                viewerCountElement.textContent = `${viewerCount} viewer${viewerCount !== 1 ? 's' : ''}`;
            } else if (data.type === 'offer' && !config.isOwner) {
                handleOffer(data);
            } else if (data.type === 'answer' && config.isOwner) {
                handleAnswer(data);
            } else if (data.type === 'candidate') {
                handleCandidate(data);
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    }

    function attemptReconnect() {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(5000, 1000 * reconnectAttempts);
            
            statusElement.textContent = `Reconnecting... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
            statusElement.style.color = "orange";
            
            console.log(`Attempting reconnect in ${delay}ms`);
            
            setTimeout(() => {
                if (socket && socket.readyState === WebSocket.CLOSED) {
                    initializeWebSocket();
                }
            }, delay);
        } else {
            statusElement.textContent = "Failed to connect. Please refresh the page.";
            statusElement.style.color = "red";
        }
    }

    async function setupStreamer() {
        try {
            // Get user media with error handling
            localStream = await navigator.mediaDevices.getUserMedia(config.mediaConstraints)
                .catch(error => {
                    console.error("Error accessing media devices:", error);
                    throw new Error("Could not access camera/microphone");
                });

            videoElement.srcObject = localStream;
            videoElement.muted = true;

            // Create peer connection with error handling
            peerConnection = new RTCPeerConnection({
                iceServers: config.iceServers
            });

            // Add tracks to connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });

            // ICE candidate handler
            peerConnection.onicecandidate = (event) => {
                if (event.candidate && socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'candidate',
                        candidate: event.candidate
                    }));
                }
            };

            peerConnection.oniceconnectionstatechange = () => {
                console.log("ICE connection state:", peerConnection.iceConnectionState);
            };

            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'offer',
                    sdp: peerConnection.localDescription
                }));
            }

            // Update viewer count periodically
            viewerCountInterval = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'viewer_count',
                        count: viewerCount
                    }));
                }
            }, 5000);

            statusElement.textContent = "Streaming live!";
            statusElement.style.color = "green";

        } catch (error) {
            console.error("Streamer setup error:", error);
            statusElement.textContent = error.message || "Stream setup failed";
            statusElement.style.color = "red";
            cleanupResources();
        }
    }

    async function setupViewer() {
        try {
            // Wait for WebSocket to be ready
            await waitForSocketConnection(5000); // 5 second timeout
            
            peerConnection = new RTCPeerConnection({
                iceServers: config.iceServers
            });

            peerConnection.onicecandidate = (event) => {
                if (event.candidate && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'candidate',
                        candidate: event.candidate
                    }));
                }
            };

            peerConnection.ontrack = (event) => {
                if (!videoElement.srcObject) {
                    videoElement.srcObject = event.streams[0];
                    statusElement.textContent = "Watching live stream";
                    statusElement.style.color = "green";
                }
            };

            peerConnection.oniceconnectionstatechange = () => {
                if (peerConnection.iceConnectionState === 'disconnected') {
                    statusElement.textContent = "Stream disconnected";
                    statusElement.style.color = "orange";
                }
            };

            // Notify server about new viewer
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'viewer_count',
                    count: 1
                }));
            }

        } catch (error) {
            console.error("Viewer setup error:", error);
            statusElement.textContent = "Failed to connect to stream";
            statusElement.style.color = "red";
            attemptReconnect();
        }
    }

    function waitForSocketConnection(timeout) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error("WebSocket connection timeout"));
                }
            }, 100);
        });
    }

    async function handleOffer(offer) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'answer',
                    sdp: peerConnection.localDescription
                }));
            }
        } catch (error) {
            console.error("Error handling offer:", error);
        }
    }

    async function handleAnswer(answer) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error("Error handling answer:", error);
        }
    }

    async function handleCandidate(candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error("Error handling ICE candidate:", error);
        }
    }

    function cleanupResources() {
        // Clear intervals
        if (viewerCountInterval) {
            clearInterval(viewerCountInterval);
        }
        
        // Stop media tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // Close peer connection
        if (peerConnection) {
            peerConnection.close();
        }
        
        // Close WebSocket
        if (socket) {
            socket.close();
        }
        
        // Clear video source
        videoElement.srcObject = null;
    }

    // End stream button handler
    if (endStreamBtn) {
        endStreamBtn.addEventListener('click', function() {
            this.style.display = 'none';
            saveOptions.style.display = 'block';
            cleanupResources();
        });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanupResources);
});