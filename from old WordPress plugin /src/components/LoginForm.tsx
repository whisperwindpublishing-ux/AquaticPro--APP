import React, { useState } from 'react';
import { HiOutlineEnvelope, HiOutlineArrowLeft, HiOutlineCheckCircle } from 'react-icons/hi2';
import { Button } from './ui/Button';

interface LoginFormProps {
    currentUrl: string;
    embedded?: boolean; // When true, don't show full-screen container
}

const LoginForm: React.FC<LoginFormProps> = ({ currentUrl, embedded = false }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Forgot password modal state
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
    const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
    const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // Use WordPress REST API for authentication via a standard form POST
            // This approach directly submits to wp-login.php and handles the redirect
            const formData = new FormData();
            formData.append('log', username);
            formData.append('pwd', password);
            formData.append('rememberme', rememberMe ? 'forever' : '');
            formData.append('redirect_to', currentUrl);
            formData.append('testcookie', '1');

            // Submit the login form directly via fetch
            const response = await fetch('/wp-login.php', {
                method: 'POST',
                body: formData,
                credentials: 'include', // Important: include cookies
                redirect: 'follow',
            });

            // Check if we got redirected back to wp-login.php (login failed)
            // or to another page (login succeeded)
            const responseUrl = response.url || '';
            
            if (responseUrl.includes('wp-login.php') && (responseUrl.includes('login_error') || responseUrl.includes('action=login'))) {
                // Login failed - check for specific error
                const text = await response.text();
                if (text.includes('Invalid username') || text.includes('invalid_username')) {
                    setError('Invalid username. Please check and try again.');
                } else if (text.includes('incorrect') || text.includes('wrong_password')) {
                    setError('Incorrect password. Please try again.');
                } else if (text.includes('empty_username')) {
                    setError('Please enter your username.');
                } else if (text.includes('empty_password')) {
                    setError('Please enter your password.');
                } else {
                    setError('Login failed. Please check your credentials and try again.');
                }
                setIsLoading(false);
                return;
            }

            // If we get here, login was likely successful
            // Force a hard page reload to pick up the new auth cookies
            window.location.reload();
            
        } catch (err) {
            // Network error or CORS issue - fall back to traditional form submission
            console.log('Fetch login failed, falling back to form submission:', err);
            
            // Create and submit a traditional form
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/wp-login.php';
            form.style.display = 'none';

            const fields = {
                'log': username,
                'pwd': password,
                'rememberme': rememberMe ? 'forever' : '',
                'redirect_to': currentUrl,
                'testcookie': '1'
            };

            Object.entries(fields).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value;
                form.appendChild(input);
            });

            document.body.appendChild(form);
            form.submit();
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotPasswordError(null);
        setForgotPasswordLoading(true);

        try {
            // Use WordPress REST API to trigger password reset
            const formData = new FormData();
            formData.append('user_login', forgotEmail);
            formData.append('redirect_to', '');
            formData.append('wp-submit', 'Get New Password');

            const response = await fetch('/wp-login.php?action=lostpassword', {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            const responseUrl = response.url || '';
            const text = await response.text();

            // Check for success indicators
            if (responseUrl.includes('checkemail=confirm') || text.includes('Check your email')) {
                setForgotPasswordSuccess(true);
            } else if (text.includes('invalid_email') || text.includes('There is no account')) {
                setForgotPasswordError('No account found with that email address.');
            } else if (text.includes('invalidcombo')) {
                setForgotPasswordError('Invalid username or email address.');
            } else {
                // Assume success if no clear error
                setForgotPasswordSuccess(true);
            }
        } catch (err) {
            console.error('Forgot password error:', err);
            setForgotPasswordError('Unable to process request. Please try again.');
        } finally {
            setForgotPasswordLoading(false);
        }
    };

    const resetForgotPassword = () => {
        setShowForgotPassword(false);
        setForgotEmail('');
        setForgotPasswordSuccess(false);
        setForgotPasswordError(null);
    };

    // Forgot Password Modal/View
    if (showForgotPassword) {
        const forgotPasswordContent = (
            <div className="ap-w-full ap-max-w-md ap-p-8 ap-space-y-6 ap-bg-white ap-shadow-lg ap-rounded-xl ap-border ap-border-gray-200">
                {forgotPasswordSuccess ? (
                    <>
                        <div className="ap-text-center">
                            <div className="ap-mx-auto ap-w-16 ap-h-16 ap-bg-green-100 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mb-4">
                                <HiOutlineCheckCircle className="ap-w-10 ap-h-10 ap-text-green-600" />
                            </div>
                            <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Check Your Email</h2>
                            <p className="ap-mt-2 ap-text-gray-600">
                                If an account exists with that email address, you'll receive a password reset link shortly.
                            </p>
                        </div>
                        <Button
                            onClick={resetForgotPassword}
                            variant="primary"
                            className="!ap-w-full"
                        >
                            Back to Login
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="ap-text-center">
                            <div className="ap-mx-auto ap-w-16 ap-h-16 ap-bg-blue-50 ap-rounded-full ap-flex ap-items-center ap-justify-center ap-mb-4">
                                <HiOutlineEnvelope className="ap-w-10 ap-h-10 ap-text-blue-600" />
                            </div>
                            <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Forgot Password?</h2>
                            <p className="ap-mt-2 ap-text-gray-600">
                                Enter your email address and we'll send you a link to reset your password.
                            </p>
                        </div>

                        {forgotPasswordError && (
                            <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                                {forgotPasswordError}
                            </div>
                        )}

                        <form onSubmit={handleForgotPassword} className="ap-space-y-4">
                            <div>
                                <label htmlFor="forgot-email" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                    Email Address or Username
                                </label>
                                <input
                                    id="forgot-email"
                                    type="text"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                                    placeholder="Enter your email or username"
                                    disabled={forgotPasswordLoading}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={forgotPasswordLoading}
                                variant="primary"
                                className="!ap-w-full"
                            >
                                {forgotPasswordLoading ? (
                                    <span className="ap-flex ap-items-center ap-justify-center">
                                        <svg className="ap-animate-spin -ap-ml-1 ap-mr-3 ap-h-5 ap-w-5 ap-text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending...
                                    </span>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </Button>
                        </form>

                        <Button
                            onClick={resetForgotPassword}
                            variant="ghost"
                            className="!ap-w-full !ap-flex !ap-items-center !ap-justify-center !ap-gap-2 !ap-text-gray-600 hover:!ap-text-blue-600"
                        >
                            <HiOutlineArrowLeft className="ap-w-4 ap-h-4" />
                            Back to Login
                        </Button>
                    </>
                )}
            </div>
        );

        if (embedded) {
            return forgotPasswordContent;
        }

        return (
            <div className="ap-min-h-screen ap-flex ap-items-center ap-justify-center ap-bg-gray-100 ap-px-4 sm:ap-px-6 lg:ap-px-8">
                {forgotPasswordContent}
            </div>
        );
    }

    // Main Login Form
    const loginFormContent = (
        <div className="ap-w-full ap-max-w-md ap-p-8 ap-space-y-6 ap-bg-white ap-shadow-lg ap-rounded-xl ap-border ap-border-gray-200">
            <div className="ap-text-center">
                <h2 className="ap-text-2xl ap-font-bold ap-text-gray-900">Log In</h2>
                <p className="ap-mt-2 ap-text-gray-600">
                    Sign in to access your dashboard
                </p>
            </div>

            {error && (
                <div className="ap-bg-red-50 ap-border ap-border-red-200 ap-text-red-700 ap-px-4 ap-py-3 ap-rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="ap-space-y-4">
                <div>
                    <label htmlFor="username" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                        Username or Email
                    </label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        placeholder="Enter your username or email"
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="password" className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500 focus:ap-border-transparent"
                        placeholder="Enter your password"
                        disabled={isLoading}
                    />
                </div>

                <div className="ap-flex ap-items-center ap-justify-between">
                    <div className="ap-flex ap-items-center">
                        <input
                            id="remember"
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="ap-h-4 ap-w-4 ap-text-blue-600 focus:ap-ring-blue-500 ap-border-gray-300 ap-rounded"
                            disabled={isLoading}
                        />
                        <label htmlFor="remember" className="ap-ml-2 ap-block ap-text-sm ap-text-gray-700">
                            Remember me
                        </label>
                    </div>
                    <Button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        variant="ghost"
                        size="sm"
                        className="!ap-text-blue-600 hover:!ap-text-blue-700 hover:!ap-underline !ap-p-0 !ap-min-h-0"
                    >
                        Forgot password?
                    </Button>
                </div>

                <Button
                    type="submit"
                    disabled={isLoading}
                    variant="primary"
                    className="!ap-w-full"
                >
                    {isLoading ? (
                        <span className="ap-flex ap-items-center ap-justify-center">
                            <svg className="ap-animate-spin -ap-ml-1 ap-mr-3 ap-h-5 ap-w-5 ap-text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="ap-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="ap-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Logging in...
                        </span>
                    ) : (
                        'Log In'
                    )}
                </Button>
            </form>
        </div>
    );

    if (embedded) {
        return loginFormContent;
    }

    return (
        <div className="ap-min-h-screen ap-flex ap-items-center ap-justify-center ap-bg-gray-100 ap-px-4 sm:ap-px-6 lg:ap-px-8">
            {loginFormContent}
        </div>
    );
};

export default LoginForm;
