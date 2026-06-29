import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Box, Button, Container, TextField, Typography } from "@mui/material";
import { orange } from "@mui/material/colors";
import { ClientResponseError } from "pocketbase";
import { useState } from "react";
import { getPb } from "@/lib/pocketbase";
import { getConfig } from "@/lib/config";

function extractError(err: unknown): string {
  if (err instanceof ClientResponseError) {
    // PocketBase returns structured error data
    const data = err.response?.data;
    if (data && typeof data === "object") {
      // e.g. { email: { code: "...", message: "..." } }
      const messages = Object.values(data)
        .map((v) => (v as { message?: string })?.message)
        .filter(Boolean);
      if (messages.length > 0) return messages.join(". ");
    }
    return err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred.";
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const config = getConfig();

  const [email, setEmail] = useState("");
  const [otpId, setOtpId] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const pb = getPb();
      const result = await pb.collection("users").requestOTP(email);
      setOtpId(result.otpId);
      setMessage("Check your email for a login code.");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const pb = getPb();
      await pb.collection("users").authWithOTP(otpId, code);
      navigate({ to: "/" });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!otpId ? (
          <form onSubmit={handleRequestOtp} style={{ width: "100%" }}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              sx={{
                "& .MuiInputLabel-root": {
                  "&.Mui-focused": {
                    color: orange[700],
                  },
                },
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": {
                    borderColor: orange[700],
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: orange[700],
                  },
                },
              }}
            />

            {config.nothingToSeeHereButtonText && (
              <Button
                disableElevation
                fullWidth
                variant="contained"
                onClick={() => navigate({ to: "/login/nothing-to-see-here" })}
                sx={{
                  mt: 3,
                  textTransform: "none",
                  backgroundColor: orange[700],
                  color: "white",
                }}
                disabled={isSubmitting}
              >
                {config.nothingToSeeHereButtonText}
              </Button>
            )}

            <Button
              disableElevation
              fullWidth
              type="submit"
              variant={config.nothingToSeeHereButtonText ? "text" : "contained"}
              sx={{
                mt: 3,
                textTransform: "none",
                ...(config.nothingToSeeHereButtonText
                  ? { color: orange[700] }
                  : { backgroundColor: orange[700], color: "white" }),
              }}
              disabled={isSubmitting}
            >
              {config.loginButtonText}
            </Button>

            {error && (
              <Typography color="error" align="center" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}

            {message && (
              <Typography color="text.secondary" align="center" sx={{ mt: 2 }}>
                {message}
              </Typography>
            )}
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ width: "100%" }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Enter the code sent to {email}
            </Typography>

            <TextField
              fullWidth
              label="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              disabled={isSubmitting}
              sx={{
                "& .MuiInputLabel-root": {
                  "&.Mui-focused": { color: orange[700] },
                },
                "& .MuiOutlinedInput-root": {
                  "&.Mui-focused fieldset": { borderColor: orange[700] },
                },
              }}
            />

            <Button
              disableElevation
              fullWidth
              type="submit"
              variant="contained"
              sx={{
                mt: 3,
                textTransform: "none",
                backgroundColor: orange[700],
                color: "white",
              }}
              disabled={isSubmitting || !code}
            >
              Verify
            </Button>

            <Button
              fullWidth
              variant="text"
              onClick={() => {
                setOtpId("");
                setCode("");
                setMessage("");
                setError("");
              }}
              sx={{ mt: 1, textTransform: "none", color: orange[700] }}
            >
              Back
            </Button>

            {error && (
              <Typography color="error" align="center" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </form>
        )}
      </Box>
    </Container>
  );
}
