import React, { useState } from 'react';

const PasswordChange = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 현재 비밀번호 확인
    const storedPassword = localStorage.getItem('adminPassword') || 'sammi1234';
    if (currentPassword !== storedPassword) {
      setError('현재 비밀번호가 올바르지 않습니다.');
      return;
    }

    // 새 비밀번호 확인
    if (newPassword.length < 6) {
      setError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
      return;
    }

    // 비밀번호 변경 성공 (실제로는 서버에 저장해야 함)
    // 여기서는 localStorage에 임시 저장
    localStorage.setItem('adminPassword', newPassword);
    setSuccess('비밀번호가 성공적으로 변경되었습니다.');
    setError('');
    
    // 3초 후 창 닫기
    setTimeout(() => {
      onClose();
    }, 3000);
  };

  return (
    <div className="password-change-overlay">
      <div className="password-change-modal">
        <h3>비밀번호 변경</h3>
        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="currentPassword">현재 비밀번호:</label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="newPassword">새 비밀번호:</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">새 비밀번호 확인:</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="button-group">
            <button type="submit" className="change-button">변경</button>
            <button type="button" onClick={onClose} className="cancel-button">취소</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordChange;
