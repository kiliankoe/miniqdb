"use client";

import { Box, Button, Container, TextField, Typography } from "@mui/material";
import { orange } from "@mui/material/colors";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    // "email" is the provider ID
    await signIn("email", { email, callbackUrl: "/" });

    setIsSubmitting(false);
    setMessage("Please check your inbox.");
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
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
            sx={{
              '& .MuiInputLabel-root': {
                '&.Mui-focused': {
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

          {process.env.NEXT_PUBLIC_NOTHING_TO_SEE_HERE_BUTTON_TEXT && (
            <Button
              disableElevation
            fullWidth
            variant="contained"
            onClick={() => {
              router.push("/login/nothing-to-see-here");
            }}
            sx={{
              mt: 3,
              textTransform: "none",
              backgroundColor: orange[700],
              color: "white",
            }}
            disabled={isSubmitting}
          >
              {process.env.NEXT_PUBLIC_NOTHING_TO_SEE_HERE_BUTTON_TEXT}
            </Button>
          )}

          <Button
            disableElevation
            fullWidth
            type="submit"
            variant={process.env.NEXT_PUBLIC_NOTHING_TO_SEE_HERE_BUTTON_TEXT ? "text" : "contained"}
            sx={{
              mt: 3,
              textTransform: "none",
              ...(process.env.NEXT_PUBLIC_NOTHING_TO_SEE_HERE_BUTTON_TEXT ? {
                color: orange[700],
              } : {
                backgroundColor: orange[700],
                color: "white",
              }),
            }}
            disabled={isSubmitting}
          >
            {process.env.NEXT_PUBLIC_LOGIN_BUTTON_TEXT ?? "Login"}
          </Button>

          {message && (
            <Typography color="text.secondary" align="center" sx={{ mt: 2 }}>
              {message}
            </Typography>
          )}
        </form>
      </Box>
    </Container>
  );
}
