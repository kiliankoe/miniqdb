"use client";

import { Box, Button, Container, TextField, Typography } from "@mui/material";
import { orange } from "@mui/material/colors";
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

          <Button
            disableElevation
            fullWidth
            variant="contained"
            onClick={() => {
              router.push("/hr");
            }}
            sx={{
              mt: 3,
              textTransform: "none",
              backgroundColor: orange[700],
              color: "white",
            }}
            disabled={isSubmitting}
          >
            I work in HR
          </Button>

          <Button
            disableElevation
            fullWidth
            type="submit"
            variant="text"
            sx={{
              mt: 3,
              textTransform: "none",
              color: orange[700],
            }}
            disabled={isSubmitting}
          >
            I promise I don&apos;t work in HR
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
