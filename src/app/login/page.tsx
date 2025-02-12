"use client";

import { useState } from "react";
import { Box, Container, TextField, Button, Typography } from "@mui/material";

export default function Login() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    // TODO: Implement your magic link authentication logic here

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
          />

          <Button disableElevation fullWidth type="submit" variant="contained" sx={{ mt: 3 }} disabled={isSubmitting}>
            Send Magic Link
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
