/**
 * Enhanced Response Handler for Smart Device Registration
 * Provides comprehensive response handling for device operations
 */

export interface SmartDeviceResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: {
    code: string;
    details: string;
    timestamp: string;
  };
  deviceInfo?: {
    deviceId: string;
    deviceType: string;
    status: 'online' | 'offline' | 'error' | 'warning';
    lastSeen: string;
  };
}

export class SmartDeviceResponseHandler {
  
  /**
   * Handle successful device registration
   */
  static handleSuccess(response: any, deviceInfo: any): SmartDeviceResponse {
    return {
      success: true,
      message: 'Device registered successfully',
      data: response,
      deviceInfo: {
        deviceId: deviceInfo.deviceId || response.deviceId,
        deviceType: deviceInfo.deviceType || 'smart_terminal',
        status: 'online',
        lastSeen: new Date().toISOString()
      }
    };
  }

  /**
   * Handle device registration errors
   */
  static handleError(error: any, deviceInfo?: any): SmartDeviceResponse {
    return {
      success: false,
      message: this.getErrorMessage(error),
      error: {
        code: error.code || 'DEVICE_REG_ERROR',
        details: error.message || 'Unknown device registration error',
        timestamp: new Date().toISOString()
      },
      deviceInfo: deviceInfo ? {
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        status: 'error',
        lastSeen: new Date().toISOString()
      } : undefined
    };
  }

  /**
   * Handle device timeout scenarios
   */
  static handleTimeout(deviceInfo: any): SmartDeviceResponse {
    return {
      success: false,
      message: 'Device registration timeout',
      error: {
        code: 'DEVICE_TIMEOUT',
        details: 'Device did not respond within expected time',
        timestamp: new Date().toISOString()
      },
      deviceInfo: {
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        status: 'offline',
        lastSeen: new Date().toISOString()
      }
    };
  }

  /**
   * Handle device validation errors
   */
  static handleValidationError(validationErrors: string[], deviceInfo: any): SmartDeviceResponse {
    return {
      success: false,
      message: 'Device validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: validationErrors.join(', '),
        timestamp: new Date().toISOString()
      },
      deviceInfo: {
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        status: 'error',
        lastSeen: new Date().toISOString()
      }
    };
  }

  /**
   * Get user-friendly error messages based on error codes
   */
  private static getErrorMessage(error: any): string {
    const errorMessages: { [key: string]: string } = {
      'DEVICE_NOT_FOUND': 'Device not found or not accessible',
      'DEVICE_ALREADY_REGISTERED': 'Device is already registered to another account',
      'DEVICE_OFFLINE': 'Device is currently offline',
      'DEVICE_INCOMPATIBLE': 'Device firmware version is not compatible',
      'NETWORK_ERROR': 'Network connectivity issues detected',
      'AUTH_FAILED': 'Device authentication failed',
      'INVALID_CREDENTIALS': 'Invalid device credentials',
      'RATE_LIMIT_EXCEEDED': 'Too many registration attempts, please try again later'
    };

    return errorMessages[(error as any).code] || 'Unknown device error occurred';
  }

  /**
   * Format device response for UI display
   */
  static formatForDisplay(response: SmartDeviceResponse): {
    status: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    details: string[];
    actions?: string[];
  } {
    if (response.success) {
      return {
        status: 'success',
        title: 'Device Connected',
        message: response.message,
        details: [`Device ID: ${response.deviceInfo?.deviceId}`, `Type: ${response.deviceInfo?.deviceType}`],
        actions: ['View Device Details', 'Configure Settings']
      };
    } else {
      return {
        status: 'error',
        title: 'Device Error',
        message: response.message,
        details: [response.error?.details || 'Unknown error'],
        actions: ['Retry Connection', 'Check Network', 'Contact Support']
      };
    }
  }
}

/**
 * Enhanced HTTP Response Interceptor for Smart Device Operations
 */
export class SmartDeviceInterceptor {
  
  /**
   * Intercept and enhance device-related HTTP responses
   */
  static interceptResponse(response: any, deviceInfo?: any): SmartDeviceResponse {
    if (response.status >= 200 && response.status < 300) {
      return SmartDeviceResponseHandler.handleSuccess(response.data, deviceInfo);
    } else if (response.status === 408) {
      return SmartDeviceResponseHandler.handleTimeout(deviceInfo);
    } else if (response.status === 422) {
      return SmartDeviceResponseHandler.handleValidationError(response.data.errors, deviceInfo);
    } else {
      return SmartDeviceResponseHandler.handleError(response.data || response, deviceInfo);
    }
  }

  /**
   * Generate device health check response
   */
  static generateHealthResponse(deviceStatus: any): SmartDeviceResponse {
    const isHealthy = deviceStatus.batteryLevel > 10 && 
                     deviceStatus.signalStrength > 20 && 
                     deviceStatus.lastSeen > Date.now() - 300000; // 5 minutes

    return {
      success: isHealthy,
      message: isHealthy ? 'Device is healthy' : 'Device needs attention',
      deviceInfo: {
        deviceId: deviceStatus.deviceId,
        deviceType: deviceStatus.deviceType,
        status: isHealthy ? 'online' : 'warning',
        lastSeen: deviceStatus.lastSeen
      }
    };
  }
}
