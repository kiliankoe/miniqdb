import { createFileRoute, Link } from "@tanstack/react-router";
import { Box, Container, Paper, Typography, Button } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { orange, red } from "@mui/material/colors";

interface ErrorSearch {
  error?: string;
}

export const Route = createFileRoute("/login/error")({
  validateSearch: (search: Record<string, unknown>): ErrorSearch => ({
    error: search.error ? String(search.error) : undefined,
  }),
  component: LoginErrorPage,
});

function LoginErrorPage() {
  const { error = "" } = Route.useSearch();
  const errorMessage = error
    ? decodeURIComponent(error)
    : "An unknown error occurred";

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
          <ErrorOutlineIcon
            sx={{
              fontSize: 48,
              color: red[500],
              mb: 2,
            }}
          />
          <Typography variant="h5" component="h1" gutterBottom>
            Login Error
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            {errorMessage}
          </Typography>
          <Box sx={{ mt: 3 }}>
            <Link to="/login" style={{ textDecoration: "none" }}>
              <Button
                disableElevation
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  textTransform: "none",
                  backgroundColor: orange[700],
                  color: "white",
                }}
              >
                Try Again
              </Button>
            </Link>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}
