import { createFileRoute } from "@tanstack/react-router";
import { Container, Typography } from "@mui/material";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/login/nothing-to-see-here")({
  component: NothingToSeeHerePage,
});

function NothingToSeeHerePage() {
  const [isShowingCloseHint, setIsShowingCloseHint] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsShowingCloseHint(true);
    }, 10_000);
    return () => clearTimeout(timer);
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
      <img src="/goat.gif" alt="Goat" width={490} height={498} />
      {isShowingCloseHint && (
        <Typography variant="h6">You may now close this tab.</Typography>
      )}
    </Container>
  );
}
