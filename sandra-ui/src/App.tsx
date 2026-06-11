import { useState, useEffect, useCallback } from 'react';
import { fetchApi, API_FILE_BASE } from './api';
import type { Assignment, StudentInfo } from './types';

function App() {
  const [loggedInUser, setLoggedInUser] = useState<{ telegramId: string; role: 'TEACHER' | 'STUDENT' } | null>(() => {
    const saved = localStorage.getItem('classroom_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [telegramId, setTelegramId] = useState('');
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('TEACHER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Teacher states
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [statusSummary, setStatusSummary] = useState<string>('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [selectedStudentTelegramId, setSelectedStudentTelegramId] = useState<string | null>(null);
  
  // Student states
  const [studentAssignments, setStudentAssignments] = useState<Assignment[]>([]);

  // Modals
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitText, setSubmitText] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [submitFile, setSubmitFile] = useState<File | null>(null);

  // Logout helper
  const handleLogout = () => {
    localStorage.removeItem('classroom_user');
    setLoggedInUser(null);
    setStudents([]);
    setAssignments([]);
    setStudentAssignments([]);
    setStatusSummary('');
    setSubmitFile(null);
  };

  // Fetch Teacher Data
  const fetchTeacherData = useCallback(async (tId: string) => {
    try {
      setError(null);
      const studentList = await fetchApi<StudentInfo[]>(`/teacher/${tId}/students`);
      setStudents(studentList);

      const assignmentList = await fetchApi<Assignment[]>(`/teacher/${tId}/assignments`);
      setAssignments(assignmentList);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to fetch teacher data.');
    }
  }, []);

  // Fetch Teacher AI Status Summary
  const fetchStatusSummary = useCallback(async (tId: string) => {
    try {
      setLoadingSummary(true);
      const res = await fetchApi<{ summary: string }>(`/teacher/${tId}/status-summary`);
      setStatusSummary(res.summary);
    } catch (err) {
      console.error(err);
      setStatusSummary('Failed to load status summary. Make sure Groq is set up.');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Fetch Student Data
  const fetchStudentData = useCallback(async (tId: string) => {
    try {
      setError(null);
      const assignmentList = await fetchApi<Assignment[]>(`/student/${tId}/assignments`);
      setStudentAssignments(assignmentList);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to fetch student data.');
    }
  }, []);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (role === 'TEACHER') {
        // Test fetch students to verify existence
        await fetchApi<StudentInfo[]>(`/teacher/${telegramId}/students`);
        const userObj = { telegramId, role };
        localStorage.setItem('classroom_user', JSON.stringify(userObj));
        setLoggedInUser(userObj);
        await fetchTeacherData(telegramId);
        fetchStatusSummary(telegramId);
      } else {
        // Test fetch assignments to verify student existence
        await fetchApi<Assignment[]>(`/student/${telegramId}/assignments`);
        const userObj = { telegramId, role };
        localStorage.setItem('classroom_user', JSON.stringify(userObj));
        setLoggedInUser(userObj);
        await fetchStudentData(telegramId);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Verification failed. Are you registered via Telegram bot?');
    } finally {
      setLoading(false);
    }
  };

  // Submit Feedback
  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !feedbackText.trim() || !loggedInUser) return;

    setSubmittingFeedback(true);
    try {
      await fetchApi(`/teacher/${loggedInUser.telegramId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          message: feedbackText,
        }),
      });
      setFeedbackModalOpen(false);
      setFeedbackText('');
      setSelectedAssignment(null);
      await fetchTeacherData(loggedInUser.telegramId);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Submit Assignment Work
  const handleSendSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !submitText.trim() || !loggedInUser) return;

    setSubmittingAssignment(true);
    try {
      const formData = new FormData();
      formData.append('assignmentId', selectedAssignment.id);
      formData.append('textContent', submitText);
      if (submitFile) {
        formData.append('file', submitFile);
      }

      await fetchApi(`/student/${loggedInUser.telegramId}/submit`, {
        method: 'POST',
        body: formData,
      });
      setSubmitModalOpen(false);
      setSubmitText('');
      setSubmitFile(null);
      setSelectedAssignment(null);
      await fetchStudentData(loggedInUser.telegramId);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to submit assignment');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!loggedInUser) return;

    const interval = setInterval(() => {
      if (loggedInUser.role === 'TEACHER') {
        fetchTeacherData(loggedInUser.telegramId);
      } else {
        fetchStudentData(loggedInUser.telegramId);
      }
    }, 30000); // refresh every 30 seconds

    // Initial load
    if (loggedInUser.role === 'TEACHER') {
      fetchTeacherData(loggedInUser.telegramId);
      fetchStatusSummary(loggedInUser.telegramId);
    } else {
      fetchStudentData(loggedInUser.telegramId);
    }

    return () => clearInterval(interval);
  }, [loggedInUser, fetchTeacherData, fetchStatusSummary, fetchStudentData]);

  // Helper for Badge styles
  const getBadgeClass = (status: Assignment['status']) => {
    switch (status) {
      case 'PENDING':
        return 'badge-pending';
      case 'IN_PROGRESS':
        return 'badge-in-progress';
      case 'SUBMITTED':
        return 'badge-submitted';
      case 'FEEDBACK_GIVEN':
        return 'badge-feedback-given';
      default:
        return '';
    }
  };

  const getStatusLabel = (status: Assignment['status']) => {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'SUBMITTED':
        return 'Submitted';
      case 'FEEDBACK_GIVEN':
        return 'Reviewed';
      default:
        return status;
    }
  };

  // LOGIN RENDER
  if (!loggedInUser) {
    return (
      <div className="landing">
        <div className="card landing-card">
          <h1 className="landing-title">Classroom Companion</h1>
          <p className="landing-subtitle">
            Welcome to the AI-Agentic Classroom Companion Web Dashboard. Enter your Telegram ID to access your workspace.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">I am a...</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className={`btn ${role === 'TEACHER' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, padding: '12px' }}
                  onClick={() => setRole('TEACHER')}
                >
                  👩‍🏫 Teacher
                </button>
                <button
                  type="button"
                  className={`btn ${role === 'STUDENT' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, padding: '12px' }}
                  onClick={() => setRole('STUDENT')}
                >
                  🎓 Student
                </button>
              </div>
            </div>

            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">Telegram ID</label>
              <form onSubmit={handleLogin} className="landing-form">
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 8758369892"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
                  {loading ? 'Entering...' : 'Log In'}
                </button>
              </form>
            </div>
            {error && (
              <div style={{ color: 'var(--accent-red)', fontSize: '0.875rem', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // TEACHER DASHBOARD RENDER
  if (loggedInUser.role === 'TEACHER') {
    const pendingReviewCount = assignments.filter((a) => a.status === 'SUBMITTED').length;
    const filteredAssignments = selectedStudentTelegramId
      ? assignments.filter((a) => a.studentTelegramId === selectedStudentTelegramId)
      : assignments;

    return (
      <div className="app-layout">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">Classroom Companion</div>
          
          <div className="sidebar-section-title">Students</div>
          <button
            className={`sidebar-item ${!selectedStudentTelegramId ? 'active' : ''}`}
            onClick={() => setSelectedStudentTelegramId(null)}
          >
            👥 All Students ({students.length})
          </button>
          
          {students.map((student) => (
            <div
              key={student.id}
              className={`sidebar-item ${selectedStudentTelegramId === student.id ? 'active' : ''}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setSelectedStudentTelegramId(student.id)}
            >
              <span>🎓 {student.name}</span>
              <button
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--accent-red)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '2px 6px',
                  transition: 'all 0.2s ease',
                  marginLeft: '8px'
                }}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (window.confirm(`Are you sure you want to remove student ${student.name}?`)) {
                    try {
                      await fetchApi(`/teacher/${loggedInUser.telegramId}/students/${student.id}`, {
                        method: 'DELETE',
                      });
                      if (selectedStudentTelegramId === student.id) {
                        setSelectedStudentTelegramId(null);
                      }
                      await fetchTeacherData(loggedInUser.telegramId);
                    } catch (err) {
                      console.error(err);
                      alert('Failed to remove student');
                    }
                  }
                }}
                title="Remove Student"
              >
                &times;
              </button>
            </div>
          ))}

          <div className="sidebar-section-title">AI Summary</div>
          <div className="card" style={{ padding: '16px', fontSize: '0.85rem', background: 'rgba(255, 255, 255, 0.02)', maxHeight: '250px', overflowY: 'auto' }}>
            {loadingSummary ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><div className="spinner" style={{ width: '20px', height: '20px' }}></div></div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                {statusSummary || 'No summary generated yet.'}
              </div>
            )}
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', marginTop: '8px', fontSize: '0.75rem', padding: '8px' }}
            onClick={() => fetchStatusSummary(loggedInUser.telegramId)}
            disabled={loadingSummary}
          >
            🔄 Refresh AI Summary
          </button>

          <div style={{ marginTop: 'auto', padding: '8px 0' }}>
            <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleLogout}>
              🚪 Log Out
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="main-content">
          <div className="page-header">
            <h1 className="page-title">Teacher Space</h1>
            <p className="page-subtitle">Manage assignments, track real-time progress, and review student deliverables.</p>
          </div>

          {/* Stats Bar */}
          <section className="stats-bar">
            <div className="stat-card">
              <span className="stat-value">{students.length}</span>
              <span className="stat-label">Linked Students</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{assignments.length}</span>
              <span className="stat-label">Total Tasks</span>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
              <span className="stat-value" style={{ color: 'var(--accent-orange)' }}>{pendingReviewCount}</span>
              <span className="stat-label">Pending Review</span>
            </div>
          </section>

          {/* Assignments Panel */}
          <section className="card" style={{ padding: '0px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {selectedStudentTelegramId 
                  ? `Assignments for ${students.find(s => s.id === selectedStudentTelegramId)?.name}` 
                  : 'All Assignments'}
              </h2>
              <button className="btn btn-ghost" onClick={() => fetchTeacherData(loggedInUser.telegramId)}>
                🔄 Sync Data
              </button>
            </div>

            <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
              {filteredAssignments.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📝</div>
                  <p className="empty-state-text">No assignments found.</p>
                  <p style={{ fontSize: '0.875rem' }}>Send an assignment text in the Telegram bot to assign a task!</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Assignment Title</th>
                      <th>Deadline</th>
                      <th>Status</th>
                      <th>Deliverable</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignments.map((assignment) => {
                      const latestSubmission = assignment.submissions[0];
                      return (
                        <tr key={assignment.id}>
                          <td style={{ fontWeight: 500 }}>{assignment.studentName}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{assignment.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {assignment.description}
                            </div>
                          </td>
                          <td>{new Date(assignment.deadline).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge ${getBadgeClass(assignment.status)}`}>
                              {getStatusLabel(assignment.status)}
                            </span>
                          </td>
                          <td>
                            {latestSubmission ? (
                              <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                📄 "{latestSubmission.textContent}"
                                {latestSubmission.filePath && (
                                  <div style={{ marginTop: '4px' }}>
                                    <a href={`${API_FILE_BASE}/${latestSubmission.filePath}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-green)', textDecoration: 'underline' }}>
                                      📎 View File
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                            )}
                          </td>
                          <td>
                            {assignment.status === 'SUBMITTED' ? (
                              <button
                                className="btn btn-primary"
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setSelectedAssignment(assignment);
                                  setFeedbackModalOpen(true);
                                }}
                              >
                                Review & Grade
                              </button>
                            ) : assignment.status === 'FEEDBACK_GIVEN' ? (
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setSelectedAssignment(assignment);
                                  setFeedbackModalOpen(true);
                                }}
                              >
                                View Review
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Awaiting Submission</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>

        {/* FEEDBACK / REVIEW MODAL */}
        {feedbackModalOpen && selectedAssignment && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <h3 className="modal-title">Review Work: {selectedAssignment.title}</h3>
                <button className="modal-close" onClick={() => { setFeedbackModalOpen(false); setSelectedAssignment(null); setFeedbackText(''); }}>&times;</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Task Prompt</h4>
                  <p style={{ color: 'var(--text-primary)', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                    {selectedAssignment.description}
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Student Submission</h4>
                  <div style={{ color: 'var(--accent-cyan)', background: 'rgba(34, 211, 238, 0.05)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 211, 238, 0.2)', whiteSpace: 'pre-wrap' }}>
                    {selectedAssignment.submissions[0]?.textContent || 'No text submitted.'}
                    {selectedAssignment.submissions[0]?.filePath && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(34, 211, 238, 0.2)' }}>
                        <a href={`${API_FILE_BASE}/${selectedAssignment.submissions[0].filePath}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline', fontWeight: 600 }}>
                          📎 View Attached File
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {selectedAssignment.status === 'FEEDBACK_GIVEN' && (
                  <div>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Sent Feedback</h4>
                    <div style={{ color: 'var(--accent-green)', background: 'rgba(52, 211, 153, 0.05)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                      {selectedAssignment.feedbacks.map((f, i) => (
                        <div key={i} style={{ marginBottom: i < selectedAssignment.feedbacks.length - 1 ? '8px' : '0' }}>
                          <div>💬 {f.message}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>{new Date(f.createdAt).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAssignment.status !== 'FEEDBACK_GIVEN' && (
                  <form onSubmit={handleSendFeedback}>
                    <div className="form-group">
                      <label className="form-label">Review Feedback</label>
                      <textarea
                        className="form-textarea"
                        placeholder="Provide detailed comments, guidance, or a grade..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        required
                      ></textarea>
                    </div>

                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => { setFeedbackModalOpen(false); setSelectedAssignment(null); setFeedbackText(''); }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={submittingFeedback}>
                        {submittingFeedback ? 'Saving Feedback...' : 'Send Review'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STUDENT DASHBOARD RENDER
  if (loggedInUser.role === 'STUDENT') {
    const completedCount = studentAssignments.filter((a) => a.status === 'FEEDBACK_GIVEN' || a.status === 'SUBMITTED').length;
    const pendingCount = studentAssignments.filter((a) => a.status === 'PENDING' || a.status === 'IN_PROGRESS').length;

    return (
      <div className="app-layout" style={{ flexDirection: 'column' }}>
        {/* Top Navbar */}
        <header style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-glass)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Classroom Companion
            </span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🎓 Student Space</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn btn-ghost" onClick={() => fetchStudentData(loggedInUser.telegramId)}>
              🔄 Sync
            </button>
            <button className="btn btn-danger" onClick={handleLogout}>
              🚪 Exit
            </button>
          </div>
        </header>

        {/* Main Student Space */}
        <main className="main-content" style={{ marginLeft: 0, padding: '32px 10%' }}>
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 className="page-title">My Studies</h1>
              <p className="page-subtitle">Track your assignments, upload work, and read teacher feedback.</p>
            </div>
            {studentAssignments.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                <span>👩‍🏫 Teacher: <strong style={{ color: 'var(--accent-blue)' }}>{studentAssignments[0].teacherName || 'Assigned'}</strong></span>
                <button
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'var(--accent-red)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={async () => {
                    const teacherName = studentAssignments[0].teacherName;
                    const teacherTelegramId = studentAssignments[0].teacherTelegramId;
                    if (!teacherTelegramId) return;

                    if (window.confirm(`Are you sure you want to unlink from teacher ${teacherName}?`)) {
                      try {
                        await fetchApi(`/student/${loggedInUser.telegramId}/teachers/${teacherTelegramId}`, {
                          method: 'DELETE',
                        });
                        await fetchStudentData(loggedInUser.telegramId);
                      } catch (err) {
                        console.error(err);
                        alert('Failed to unlink from teacher');
                      }
                    }
                  }}
                >
                  Unlink
                </button>
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <section className="stats-bar">
            <div className="stat-card">
              <span className="stat-value">{studentAssignments.length}</span>
              <span className="stat-label">Total Assignments</span>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
              <span className="stat-value" style={{ color: 'var(--accent-orange)' }}>{pendingCount}</span>
              <span className="stat-label">Active / In Progress</span>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
              <span className="stat-value" style={{ color: 'var(--accent-green)' }}>{completedCount}</span>
              <span className="stat-label">Submissions Done</span>
            </div>
          </section>

          {/* Assignment List */}
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px' }}>Active Assignments</h2>
          
          {studentAssignments.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">📚</div>
                <p className="empty-state-text">No assignments assigned yet.</p>
                <p style={{ fontSize: '0.875rem' }}>Link your teacher using `/link_teacher YOUR_TEACHER_CODE` in the Telegram bot.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
              {studentAssignments.map((assignment) => {
                const latestSubmission = assignment.submissions[0];
                const latestFeedback = assignment.feedbacks[0];
                
                return (
                  <div key={assignment.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{assignment.title}</h3>
                        <span className={`badge ${getBadgeClass(assignment.status)}`}>
                          {getStatusLabel(assignment.status)}
                        </span>
                      </div>
                      
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px', lineHeight: 1.5 }}>
                        {assignment.description}
                      </p>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                        <span>📅 Due: {new Date(assignment.deadline).toLocaleDateString()}</span>
                        <span>👩‍🏫 {assignment.teacherName}</span>
                      </div>

                      {latestSubmission && (
                        <div style={{ marginTop: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Your Submission</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', whiteSpace: 'pre-wrap' }}>"{latestSubmission.textContent}"</div>
                          {latestSubmission.filePath && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)' }}>
                              <a href={`${API_FILE_BASE}/${latestSubmission.filePath}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline', fontSize: '0.8rem' }}>
                                📎 Attached File
                              </a>
                            </div>
                          )}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Submitted: {new Date(latestSubmission.submittedAt).toLocaleDateString()}</div>
                        </div>
                      )}

                      {latestFeedback && (
                        <div style={{ marginTop: '12px', background: 'rgba(52, 211, 153, 0.05)', border: '1px solid rgba(52, 211, 153, 0.2)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--accent-green)', marginBottom: '4px', fontWeight: 600 }}>Teacher Review</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>💬 {latestFeedback.message}</div>
                        </div>
                      )}
                    </div>

                    {(assignment.status === 'PENDING' || assignment.status === 'IN_PROGRESS') && (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '12px' }}
                        onClick={() => {
                          setSelectedAssignment(assignment);
                          setSubmitModalOpen(true);
                        }}
                      >
                        Submit Response
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* SUBMISSION MODAL */}
        {submitModalOpen && selectedAssignment && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3 className="modal-title">Submit Response: {selectedAssignment.title}</h3>
                <button className="modal-close" onClick={() => { setSubmitModalOpen(false); setSelectedAssignment(null); setSubmitText(''); setSubmitFile(null); }}>&times;</button>
              </div>

              <form onSubmit={handleSendSubmission}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Task Instructions</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                      {selectedAssignment.description}
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Write your submission text</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Type your response here..."
                      value={submitText}
                      onChange={(e) => setSubmitText(e.target.value)}
                      required
                    ></textarea>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Attach File / Image (Optional)</label>
                    <input
                      type="file"
                      className="form-input"
                      onChange={(e) => setSubmitFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => { setSubmitModalOpen(false); setSelectedAssignment(null); setSubmitText(''); setSubmitFile(null); }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={submittingAssignment}>
                      {submittingAssignment ? 'Submitting...' : 'Submit Work'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default App;
