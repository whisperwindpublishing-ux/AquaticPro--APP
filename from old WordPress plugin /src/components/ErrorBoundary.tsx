import React, { Component, ErrorInfo, ReactNode } from 'react';
import { HiOutlineExclamationTriangle, HiOutlineArrowPath } from 'react-icons/hi2';
import { Button } from './ui/Button';

interface Props {
    children: ReactNode;
    componentName?: string;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child component tree.
 * Logs errors to console with detailed stack traces for debugging.
 */
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const { componentName, onError } = this.props;
        
        // Detailed logging for crash diagnosis
        console.group(`🔴 [ErrorBoundary] Crash in ${componentName || 'Unknown Component'}`);
        console.error('Error:', error.message);
        console.error('Error name:', error.name);
        console.error('Stack trace:', error.stack);
        console.error('Component stack:', errorInfo.componentStack);
        console.error('Full error object:', error);
        console.groupEnd();

        // Log to window for easy access in browser console
        (window as any).__LAST_REACT_ERROR = {
            timestamp: new Date().toISOString(),
            componentName,
            error: {
                message: error.message,
                name: error.name,
                stack: error.stack,
            },
            componentStack: errorInfo.componentStack,
        };

        console.info('💡 Access full error details via: window.__LAST_REACT_ERROR');

        this.setState({ errorInfo });

        // Call optional error callback
        if (onError) {
            onError(error, errorInfo);
        }
    }

    private handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    public render() {
        const { hasError, error, errorInfo } = this.state;
        const { children, componentName, fallback } = this.props;

        if (hasError) {
            // Custom fallback provided
            if (fallback) {
                return fallback;
            }

            // Default error UI
            return (
                <div className="ap-p-6 ap-bg-red-50 ap-border ap-border-red-200 ap-rounded-lg">
                    <div className="ap-flex ap-items-start ap-gap-3">
                        <HiOutlineExclamationTriangle className="ap-w-6 ap-h-6 ap-text-red-500 ap-flex-shrink-0 ap-mt-0.5" />
                        <div className="ap-flex-1 ap-min-w-0">
                            <h3 className="ap-text-lg ap-font-semibold ap-text-red-800">
                                {componentName ? `${componentName} crashed` : 'Something went wrong'}
                            </h3>
                            <p className="ap-mt-1 ap-text-sm ap-text-red-700">
                                {error?.message || 'An unexpected error occurred'}
                            </p>
                            
                            {/* Show stack trace in development */}
                            {process.env.NODE_ENV === 'development' && error?.stack && (
                                <details className="ap-mt-3">
                                    <summary className="ap-text-xs ap-text-red-600 ap-cursor-pointer hover:ap-text-red-800">
                                        Show technical details
                                    </summary>
                                    <pre className="ap-mt-2 ap-p-3 ap-bg-red-100 ap-rounded ap-text-xs ap-overflow-auto ap-max-h-48 ap-text-red-900">
                                        {error.stack}
                                    </pre>
                                    {errorInfo?.componentStack && (
                                        <pre className="ap-mt-2 ap-p-3 ap-bg-red-100 ap-rounded ap-text-xs ap-overflow-auto ap-max-h-32 ap-text-red-900">
                                            Component Stack:{errorInfo.componentStack}
                                        </pre>
                                    )}
                                </details>
                            )}

                            <Button
                                onClick={this.handleReset}
                                variant="danger"
                                className="ap-mt-4"
                                leftIcon={<HiOutlineArrowPath className="ap-w-4 ap-h-4" />}
                            >
                                Try Again
                            </Button>
                            
                            <p className="ap-mt-3 ap-text-xs ap-text-red-600">
                                Error details logged to browser console (F12 → Console)
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return children;
    }
}

export default ErrorBoundary;

/**
 * HOC to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    componentName: string
): React.FC<P> {
    return function WithErrorBoundaryWrapper(props: P) {
        return (
            <ErrorBoundary componentName={componentName}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}

/**
 * Utility to log errors from try-catch blocks in a consistent format
 */
export function logCrash(componentName: string, error: unknown, context?: Record<string, any>) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    console.group(`🔴 [${componentName}] Crash`);
    console.error('Error:', errorObj.message);
    console.error('Stack:', errorObj.stack);
    if (context) {
        console.error('Context:', context);
    }
    console.groupEnd();

    // Store for debugging
    (window as any).__LAST_CRASH = {
        timestamp: new Date().toISOString(),
        componentName,
        error: {
            message: errorObj.message,
            name: errorObj.name,
            stack: errorObj.stack,
        },
        context,
    };
}
