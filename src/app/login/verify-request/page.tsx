import { Box, Container, Paper, Typography } from "@mui/material";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import { orange } from "@mui/material/colors";

export default function VerifyRequestPage() {
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
        <Paper
          elevation={0}
          sx={{
            p: 4,
            width: "100%",
            textAlign: "center",
          }}
        >
          <MarkEmailReadIcon
            sx={{
              fontSize: 48,
              color: orange[700],
              mb: 2,
            }}
          />
          <Typography variant="h5" component="h1" gutterBottom>
            Check your email
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
