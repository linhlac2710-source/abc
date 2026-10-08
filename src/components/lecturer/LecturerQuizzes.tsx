import React, { useEffect, useState } from 'react';
import { QuizzesAPI, QuizRecord, QuizResultRecord } from '../../api/quizzes';
import { Course } from '../../types';

interface LecturerQuizzesProps {
  courses: Course[];
}

export const LecturerQuizzes: React.FC<LecturerQuizzesProps> = ({ courses }) => {
  const [classId, setClassId] = useState(Number(courses[0]?.id || 0));
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);
  const [selected, setSelected] = useState<QuizRecord | null>(null);
  const [results, setResults] = useState<QuizResultRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalPoints, setTotalPoints] = useState(100);
  const [editing, setEditing] = useState<QuizRecord | null>(null);

  const refresh = async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const items = await QuizzesAPI.listForClass(classId);
      setQuizzes(items);
      setSelected((current) => items.find((item) => item.id === current?.id) || items[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setClassId(Number(courses[0]?.id || 0));
  }, [courses]);
  useEffect(() => { void refresh(); }, [classId]);

  const createQuiz = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await QuizzesAPI.create(classId, { title: title.trim(), description: description.trim(), total_points: totalPoints, is_active: true });
      setTitle('');
      setDescription('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleQuiz = async (quiz: QuizRecord) => {
    try {
      await QuizzesAPI.patch(quiz.id, { is_active: !quiz.is_active });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const updateQuiz = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    try {
      await QuizzesAPI.update(editing.id, { title: editing.title, description: editing.description || '', total_points: editing.total_points });
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteQuiz = async (quiz: QuizRecord) => {
    try {
      await QuizzesAPI.delete(quiz.id);
      if (selected?.id === quiz.id) setSelected(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const loadResults = async (quiz: QuizRecord) => {
    setSelected(quiz);
    try {
      const detail = await QuizzesAPI.get(quiz.id);
      setSelected(detail);
      setResults(await QuizzesAPI.listResults(quiz.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Quiz Management</h2>
        <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} className="rounded-xl border px-3 py-2 text-xs">
          {courses.map((course) => <option key={course.id} value={course.id}>{course.code || course.class_code}</option>)}
        </select>
      </div>
      {loading && <p className="text-xs text-slate-500">Loading quizzes...</p>}
      {error && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      <form onSubmit={createQuiz} className="grid gap-2 rounded-2xl border bg-white p-4 sm:grid-cols-4">
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title" className="rounded-xl border px-3 py-2 text-sm" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="rounded-xl border px-3 py-2 text-sm" />
        <input type="number" min={1} value={totalPoints} onChange={(e) => setTotalPoints(Number(e.target.value))} className="rounded-xl border px-3 py-2 text-sm" />
        <button className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Create quiz</button>
      </form>
      {quizzes.length === 0 && !loading ? <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">No quizzes for this class.</p> : (
        <div className="grid gap-3">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="flex items-center justify-between rounded-2xl border bg-white p-4">
              <button className="text-left" onClick={() => void loadResults(quiz)}>
                <p className="font-bold">{quiz.title}</p>
                <p className="text-xs text-slate-500">{quiz.total_points} points · {quiz.is_active ? 'Đang hoạt động' : 'Inactive'}</p>
              </button>
              <div className="flex gap-2"><button onClick={() => setEditing(quiz)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold">Edit</button><button onClick={() => void toggleQuiz(quiz)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold">{quiz.is_active ? 'Deactivate' : 'Activate'}</button><button onClick={() => void deleteQuiz(quiz)} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Delete</button></div>
            </div>
          ))}
        </div>
      )}
      {editing && <form onSubmit={updateQuiz} className="grid gap-2 rounded-2xl border bg-white p-4 sm:grid-cols-4"><input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" /><input value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" /><input type="number" min={1} value={editing.total_points} onChange={(e) => setEditing({ ...editing, total_points: Number(e.target.value) })} className="rounded-xl border px-3 py-2 text-sm" /><button className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Save quiz</button></form>}
      {selected && <div className="rounded-2xl border bg-white p-4"><h3 className="font-bold">Results: {selected.title}</h3>{results.length === 0 ? <p className="mt-2 text-xs text-slate-500">No results returned.</p> : results.map((result) => <p key={result.id} className="mt-2 text-sm">{result.student_name || result.student_code || result.student_id}: {result.score}/{result.max_score} ({result.percentage}%)</p>)}</div>}
    </div>
  );
};
