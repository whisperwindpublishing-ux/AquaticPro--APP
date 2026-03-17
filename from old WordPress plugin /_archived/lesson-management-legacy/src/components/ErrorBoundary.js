/**
 * WordPress dependencies
 */
import { Component } from 'react';

/**
 * A standard React Error Boundary component.
 * This component catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI instead of the crashed component tree.
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to the console for debugging.
        console.error("Uncaught error in React component tree:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg"><h2>Something went wrong.</h2><p>Please refresh the page and try again.</p></div>;
        }
        return this.props.children;
    }
}

export default ErrorBoundary;