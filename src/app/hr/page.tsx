import { Container, Typography } from "@mui/material";
import Image from "next/image";

export default function HRPage() {
  return (
    <Container
      maxWidth="md"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: "20px",
      }}
    >
      <Typography variant="h4">Please enjoy this GIF of a cute goat.</Typography>
      <Image src="/goat.gif" alt="Goat" width={490} height={498} />
    </Container>
  );
}
