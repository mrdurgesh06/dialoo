package com.narayanix.dialoo.controller;
import com.narayanix.dialoo.service.ForbiddenException;
import com.narayanix.dialoo.service.TooManyRequestsException;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
@RestControllerAdvice
public class ApiExceptionHandler {
 @ExceptionHandler(TooManyRequestsException.class) ResponseEntity<?> tooMany(TooManyRequestsException e){return ResponseEntity.status(429).header("Retry-After",String.valueOf(e.getRetryAfterSeconds())).body(Map.of("error",e.getMessage(),"retryAfterSeconds",e.getRetryAfterSeconds()));}
 @ExceptionHandler(IllegalStateException.class) ResponseEntity<?> illegalState(IllegalStateException e){return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error",e.getMessage()==null?"External service failed":e.getMessage()));}
 @ExceptionHandler(IllegalArgumentException.class) ResponseEntity<?> badRequest(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("error",e.getMessage()));}
 @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException e){return ResponseEntity.badRequest().body(Map.of("error","Validation failed","details",e.getBindingResult().getFieldErrors().stream().map(x->x.getField()+": "+x.getDefaultMessage()).toList()));}
 @ExceptionHandler(DuplicateKeyException.class) ResponseEntity<?> duplicate(DuplicateKeyException e){return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error","A record with this unique value already exists"));}
 @ExceptionHandler(ForbiddenException.class) ResponseEntity<?> forbidden(ForbiddenException e){return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error",e.getMessage()));}
 @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class) ResponseEntity<?> denied(org.springframework.security.access.AccessDeniedException e){return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error","You do not have access to this resource."));}
 @ExceptionHandler(org.springframework.dao.EmptyResultDataAccessException.class) ResponseEntity<?> notFound(org.springframework.dao.EmptyResultDataAccessException e){return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error","Record not found"));}
 @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(Exception e){org.slf4j.LoggerFactory.getLogger(ApiExceptionHandler.class).error("Unhandled error",e);return ResponseEntity.status(500).body(Map.of("error","Internal server error"));}
}
