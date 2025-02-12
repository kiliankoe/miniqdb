"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TextField, Button, Container, Box } from "@mui/material";

export default function NewQuotePage() {
  return (
    <Container maxWidth="sm">
      <AddForm />
    </Container>
  );
}

function AddForm() {
  const router = useRouter();
  const [newQuote, setNewQuote] = useState("");

  const randomQuote = "random quote";

  return (
    <Box
      component="form"
      onSubmit={async (e) => {
        e.preventDefault();
        // await addQuote(newQuote);
        // TODO: Do the reddit equivalent of auto-upvoting the quote
        router.push("/");
      }}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        mt: 4,
      }}
    >
      <TextField
        name="quote"
        placeholder={randomQuote}
        value={newQuote}
        onChange={(e) => setNewQuote(e.target.value)}
        multiline
        rows={4}
        variant="outlined"
        // sx={{
        //   "& .MuiOutlinedInput-root": {
        //     bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.800" : "grey.100"),
        //   },
        // }}
      />
      <Button
        type="submit"
        variant="contained"
        disableElevation
        disabled={newQuote.length < 5}
        sx={{
          width: { md: "256px" },
          mx: "auto",
          bgcolor: (theme) => (theme.palette.mode === "dark" ? "orange.900" : "orange.400"),
          "&:hover": {
            bgcolor: (theme) => (theme.palette.mode === "dark" ? "orange.800" : "orange.500"),
          },
          "&:disabled": {
            bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.700" : "grey.200"),
          },
        }}
      >
        Submit
      </Button>
    </Box>
  );
}
