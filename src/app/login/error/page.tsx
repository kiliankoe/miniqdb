import { Box, Container, Paper, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { orange, red } from '@mui/material/colors';
import Link from 'next/link';

export default async function LoginErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorMessage = error
    ? decodeURIComponent(error)
    : 'An unknown error occurred';

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4,
            width: '100%',
            textAlign: 'center',
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
            <Link href="/login" passHref style={{ textDecoration: 'none' }}>
              <Button
                disableElevation
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  textTransform: 'none',
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
