"use client";

import { Container, Typography } from "@mui/material";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function HRPage() {
  const [isShowingCloseHint, setIsShowingCloseHint] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setIsShowingCloseHint(true);
    }, 10_000);
  }, []);

  return (
    <Container
      maxWidth="md"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "20px",
      }}
    >
      <Typography variant="h4">
        Please enjoy this GIF of a cute goat.
      </Typography>
      <Image src="/goat.gif" alt="Goat" width={490} height={498} />
      {isShowingCloseHint && (
        <Typography variant="h6">You may now close this tab.</Typography>
      )}
    </Container>
  );
}
