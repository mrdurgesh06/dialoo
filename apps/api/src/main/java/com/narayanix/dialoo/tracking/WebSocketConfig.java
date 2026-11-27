package com.narayanix.dialoo.tracking;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

/**
 * STOMP over WebSocket.  Endpoint /ws/tracking (wss:// behind Render's TLS), application prefix /app, broker /topic + /queue, user prefix /user.
 * Server and clients exchange heartbeats every 10 s so half-open mobile connections are detected and the client can reconnect.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
  private final StompAuthInterceptor interceptor; private final TaskScheduler scheduler; private final String[] origins;

  public WebSocketConfig(StompAuthInterceptor interceptor, @Lazy TaskScheduler scheduler, @Value("${app.cors.allowed-origin}") String allowedOrigin) {
    this.interceptor = interceptor; this.scheduler = scheduler;
    this.origins = Arrays.stream(allowedOrigin.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
  }

  @Override public void registerStompEndpoints(StompEndpointRegistry registry) {
    registry.addEndpoint("/ws/tracking").setAllowedOrigins(origins);   // same allow-list as CORS; no wildcard
  }

  @Override public void configureMessageBroker(MessageBrokerRegistry registry) {
    registry.setApplicationDestinationPrefixes("/app");
    registry.setUserDestinationPrefix("/user");
    registry.enableSimpleBroker("/topic", "/queue").setHeartbeatValue(new long[]{10_000, 10_000}).setTaskScheduler(scheduler);
  }

  @Override public void configureClientInboundChannel(ChannelRegistration registration) { registration.interceptors(interceptor); }

  @Override public void configureWebSocketTransport(WebSocketTransportRegistration t) {
    t.setMessageSizeLimit(16 * 1024).setSendBufferSizeLimit(256 * 1024).setSendTimeLimit(10_000).setTimeToFirstMessage(15_000);   // sockets that never send CONNECT are closed after 15 s
  }
}
