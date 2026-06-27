const API_BASE_URL = window.location.origin;

window.addEventListener('DOMContentLoaded', () => {
  console.log('Reset password JS loaded');

  const submitBtn = document.getElementById('submitBtn');
  const messageBox = document.getElementById('message');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const requestId = params.get('request_id');

  function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = 'message ' + type;
  }

  function validateResetLink() {
    if (!token || !requestId) {
      showMessage(
        'This password reset link is invalid or incomplete. Please request a new password reset link.',
        'error',
      );

      submitBtn.disabled = true;
      return false;
    }

    return true;
  }

  validateResetLink();

  submitBtn.addEventListener('click', async () => {
    if (!validateResetLink()) {
      return;
    }

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (password !== confirmPassword) {
      showMessage('Passwords do not match.', 'error');
      return;
    }

    if (password.length < 8) {
      showMessage('Password must be at least 8 characters.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/managers/password-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          request_id: requestId,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Unable to update password.');
      }

      showMessage(
        'Your password has been updated successfully. You can now log in with your new password.',
        'success',
      );

      passwordInput.value = '';
      confirmPasswordInput.value = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Password Updated';
    } catch (error) {
      showMessage(error.message || 'Something went wrong. Please try again.', 'error');

      submitBtn.disabled = false;
      submitBtn.textContent = 'Update Password';
    }
  });
});
