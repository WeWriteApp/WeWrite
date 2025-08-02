"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { addUsername, checkUsernameAvailability } from "../../utils/apiClient";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { LoadingButton } from "../../components/ui/loading-button";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Check, Loader2, X, AlertCircle } from "lucide-react";
import { ModernAuthLayout } from "../../components/layout/modern-auth-layout";
import { cn } from "../../lib/utils";
import { debounce } from "lodash";
import { useWeWriteAnalytics } from "../../hooks/useWeWriteAnalytics";
import { validateUsernameFormat, getUsernameErrorMessage, suggestCleanUsername } from "../../utils/usernameValidation";

function SetupUsernameContent() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  // Username validation state
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  const router = useRouter();
  const { trackAuthEvent } = useWeWriteAnalytics();

  // Check if user came from the registration flow
  useEffect(() => {
    const pendingEmail = localStorage.getItem('pendingUserEmail');
    const pendingUserId = localStorage.getItem('pendingUserId');
    
    if (!pendingEmail || !pendingUserId) {
      // Redirect to registration if no pending user data
      router.push('/auth/register');
      return;
    }
    
    setUserEmail(pendingEmail);
    setUserId(pendingUserId);
  }, [router]);

  // Username validation
  const checkUsername = debounce(async (value: string) => {
    // Reset validation state
    setValidationError(null);
    setValidationMessage(null);
    setUsernameSuggestions([]);

    // Skip validation for empty usernames
    if (!value) {
      setIsAvailable(null);
      return;
    }

    // First, validate format client-side
    const formatValidation = validateUsernameFormat(value);
    if (!formatValidation.isValid) {
      setIsAvailable(false);
      setValidationError(formatValidation.error);
      setValidationMessage(formatValidation.message);

      // If it contains whitespace, suggest a cleaned version
      if (formatValidation.error === "CONTAINS_WHITESPACE") {
        const cleanSuggestion = suggestCleanUsername(value);
        if (cleanSuggestion && cleanSuggestion !== value) {
          setUsernameSuggestions([cleanSuggestion]);
        }
      }
      return;
    }

    // Check availability
    setIsChecking(true);
    try {
      const result = await checkUsernameAvailability(value);

      if (typeof result === 'boolean') {
        // Handle legacy boolean response
        setIsAvailable(result);
        if (!result) {
          setValidationError("USERNAME_TAKEN");
          setValidationMessage("Username already taken");
        }
      } else {
        // Handle new object response
        setIsAvailable(result.isAvailable);
        setValidationMessage(result.message || null);
        setValidationError(result.error || null);

        // Set username suggestions if available
        if (result.suggestions && Array.isArray(result.suggestions)) {
          setUsernameSuggestions(result.suggestions);
        }
      }
    } catch (error) {
      console.error("Error checking username:", error);
      setIsAvailable(false);
      setValidationError("CHECK_FAILED");
      setValidationMessage("Could not verify username availability");
    } finally {
      setIsChecking(false);
    }
  }, 500);

  // Trigger username validation when username changes
  useEffect(() => {
    if (username) {
      checkUsername(username);
    } else {
      setIsAvailable(null);
      setValidationError(null);
      setValidationMessage(null);
    }

    return () => {
      checkUsername.cancel();
    };
  }, [username, checkUsername]);

  // Handle clicking on a username suggestion
  const handleSuggestionClick = (suggestion: string) => {
    setUsername(suggestion);
    // Immediately check the availability of the suggested username
    checkUsername.cancel();
    checkUsername(suggestion);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!isAvailable || validationError) {
      setError("Please choose an available username");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Add username to the user account
      const result = await addUsername(userId, username);
      
      if (result.success) {
        // SECURITY: Don't log sensitive user actions
        console.log("Username added successfully, redirecting to email verification");

        // Track user creation event (this completes the user registration process)
        trackAuthEvent('USER_CREATED', {
          user_id: userId,
          username: username,
          email: userEmail,
          registration_method: 'email_password_simplified'
        });

        // Clear pending user data
        localStorage.removeItem('pendingUserEmail');
        localStorage.removeItem('pendingUserId');

        // Store username for email verification step
        localStorage.setItem('pendingUsername', username);

        // Redirect to email verification page
        router.push('/auth/verify-email');
      } else {
        setError("Failed to set username. Please try again.");
      }
    } catch (error: any) {
      console.error("Error setting username:", error);
      setError(error.message || "Failed to set username. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = username.length >= 3 && isAvailable === true && !validationError;

  return (
    <ModernAuthLayout>
      <div className="flex flex-col items-center gap-1 sm:gap-2 text-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Choose Your Username</h1>
        <p className="text-balance text-xs sm:text-sm text-muted-foreground">
          Almost done! Choose a username for {userEmail}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username" className={cn(
            "text-sm font-medium",
            validationError ? "text-destructive" : ""
          )}>
            Username
          </Label>
          <div className="relative">
            <Input
              id="username"
              type="text"
              placeholder="yourname"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn(
                "h-10 bg-background pr-10",
                validationError ? "border-destructive focus-visible:ring-destructive" : "",
                isAvailable === true ? "border-success focus-visible:ring-success" : ""
              )}
              autoComplete="username"
              autoFocus
            />
            {isChecking && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isChecking && username && username.length >= 3 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isAvailable ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            )}
          </div>
          
          {validationMessage && (
            <div className={cn(
              "mt-1",
              validationError ? "text-destructive" : "text-muted-foreground"
            )}>
              <p className="text-xs">{validationMessage}</p>

              {/* Username suggestions */}
              {validationError === "USERNAME_TAKEN" && usernameSuggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-foreground mb-1.5">Try one of these instead:</p>
                  <div className="flex flex-wrap gap-2">
                    {usernameSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="px-2 py-1 text-xs font-medium rounded-md bg-background border border-input hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Username must be at least 3 characters and can only contain letters, numbers, and underscores. Spaces and whitespace characters are not allowed.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col space-y-2">
          <LoadingButton
            type="submit"
            isLoading={isLoading}
            loadingText="Setting up username..."
            disabled={!isFormValid}
            className="w-full"
          >
            Continue
          </LoadingButton>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/auth/register")}
            className="w-full"
          >
            Back
          </Button>
        </div>
      </form>
    </ModernAuthLayout>
  );
}

export default function SetupUsernamePage() {
  return (
    <Suspense fallback={
      <ModernAuthLayout>
        <div className="flex flex-col items-center gap-1 sm:gap-2 text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Choose Your Username</h1>
          <p className="text-balance text-xs sm:text-sm text-muted-foreground">
            Setting up your account...
          </p>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        </div>
      </ModernAuthLayout>
    }>
      <SetupUsernameContent />
    </Suspense>
  );
}