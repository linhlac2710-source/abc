import React, { useEffect, useState } from 'react';
import { QuizzesAPI } from '../../api/quizzes';

type Quiz = {
  id: number;
  class_id: number;
  title: string;
  description?: string | null;
  total_points: number;
  available_from?: string | null;
  due_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // UI convenience
  classId?: string | number;
  class_code?: string;
};

type QuizResult = {
  id: number;
  quiz_id?: number;
  class_id: number;
  student_id: number;
  student_code?: string | null;
  student_name?: string | null;
  topic: string;
  score: number;
  max_score: number;
  percentage: number;
  attempt_number: number;
  created_at: string;
};

export const StudentQuizzes: React.FC<{ classIds?: Array<string | number> }> = ({ classIds = [] }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [myResult, setMyResult] = useState<QuizResult | null>(null);
  const [resultLoading, setResultLoading] = useState<boolean>(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [notAttempted, setNotAttempted] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const all: Quiz[] = [];
        for (const cid of classIds) {
          try {
            const list = await QuizzesAPI.listForClass(Number(cid));
            // Normalize response to Quiz[]
            const normalized = (list as any[]).map((q) => ({ ...q, classId: cid } as Quiz));
            all.push(...normalized);
          } catch (err: any) {
            // show a friendly message for class-level failures but continue
            // don't treat as fatal unless no quizzes at all
            console.debug('Failed to load quizzes for class', cid, err?.message || err);
          }
        }
        if (!mounted) return;
        setQuizzes(all);
      } catch (err: any) {
        setError(err?.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [classIds]);

  const openDetail = async (quizId: number) => {
    setSelectedQuiz(null);
    setMyResult(null);
    setNotAttempted(false);
    setDetailError(null);
    setResultError(null);
    setDetailLoading(true);
    try {
      const q = await QuizzesAPI.get(Number(quizId));
      setSelectedQuiz(q as Quiz);
      // load my result; treat 404 as not attempted
      setResultLoading(true);
      try {
        const r = await QuizzesAPI.myResult(Number(quizId));
        setMyResult(r as QuizResult);
      } catch (re: any) {
        if (re && re.status === 404) {
          setNotAttempted(true);
        } else {
          // map common backend statuses to friendly messages
          if (re && re.status === 403) setResultError('Access denied for quiz result.');
          else if (re && re.status === 409) setResultError(re?.data?.detail || 'Quiz not available or deadline passed.');
          else setResultError(re?.message || String(re));
        }
      } finally {
        setResultLoading(false);
      }
    } catch (err: any) {
      if (err && err.status === 404) setDetailError('Quiz not found.');
      else if (err && err.status === 403) setDetailError('You are not enrolled in this class.');
      else if (err && err.status === 409) setDetailError(err?.data?.detail || 'Quiz is not available.');
      else setDetailError(err?.message || String(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const backToList = () => {
    setSelectedQuiz(null);
    setDetailError(null);
    setMyResult(null);
    setNotAttempted(false);
  };

  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '');

  if (loading) return <div className="p-6 text-center text-slate-500">Loading quizzes...</div>;
  if (error) return (
    <div className="p-6 text-center text-rose-600">{error}</div>
  );

  if (selectedQuiz) {
    return (
      <div>
        <div className="mb-4">
          <button className="text-sky-600 underline" onClick={backToList}>Back to quizzes</button>
        </div>
        {detailLoading ? (
          <div className="p-6 text-slate-500">Loading quiz details...</div>
        ) : detailError ? (
          <div className="p-6 text-rose-600">{detailError}</div>
        ) : (
          <div className="bg-white p-4 rounded-xl border">
            <div className="text-lg font-bold">{selectedQuiz.title}</div>
            <div className="text-sm text-slate-500 mt-1">{selectedQuiz.description}</div>
            <div className="mt-2 text-xs text-slate-400">Class: {selectedQuiz.class_code || selectedQuiz.classId || selectedQuiz.class_id}</div>
            <div className="mt-2 text-xs text-slate-400">Points: {selectedQuiz.total_points}</div>
            <div className="mt-1 text-xs text-slate-400">Available: {fmtDate(selectedQuiz.available_from)} — Due: {fmtDate(selectedQuiz.due_at)}</div>

            <div className="mt-4">
              <div className="text-sm font-semibold">My Result</div>
              {resultLoading ? (
                <div className="text-slate-500">Loading your result...</div>
              ) : resultError ? (
                <div className="text-rose-600">{resultError}</div>
              ) : notAttempted ? (
                <div className="text-slate-500">You have not attempted this quiz yet.</div>
              ) : myResult ? (
                <div className="mt-2 text-sm">
                  <div>Score: {myResult.score} / {myResult.max_score}</div>
                  <div>Percentage: {myResult.percentage}%</div>
                  <div>Attempt: {myResult.attempt_number}</div>
                  <div className="text-xs text-slate-400">Submitted: {fmtDate(myResult.created_at)}</div>
                </div>
              ) : (
                <div className="text-slate-500">No result available.</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (quizzes.length === 0) return (
    <div className="p-6 text-center text-slate-500">No quizzes available for your classes.</div>
  );

  return (
    <div className="space-y-4">
      {quizzes.map((q) => (
        <div key={q.id} className="bg-white p-4 rounded-xl border flex justify-between items-start cursor-pointer" onClick={() => openDetail(q.id)}>
          <div>
            <div className="text-sm font-bold">{q.title}</div>
            <div className="text-xs text-slate-500">{q.description || ''}</div>
            <div className="text-xs text-slate-400 mt-2">Class: {q.class_code || q.classId || 'N/A'}</div>
          </div>
          <div className="text-right text-xs">
            <div>{q.total_points ? `${q.total_points} pts` : ''}</div>
            <div className="text-slate-400">{fmtDate(q.available_from)}</div>
            <div className="text-slate-400">{fmtDate(q.due_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StudentQuizzes;
