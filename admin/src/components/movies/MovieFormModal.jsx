import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Save, X } from 'lucide-react';

const EMPTY_MOVIE = {
  id: '',
  title: '',
  image: '',
  release: '',
  language: 'Tamil',
  year: String(new Date().getFullYear()),
  category: '',
  duration: '',
  director: '',
  starring: '',
  story: '',
  p360: '',
  p720: '',
  p1080: '',
  created_at: new Date().toISOString().split('T')[0],
  type: 'hollywood',
  status: 'Active'
};

const languages = ['Tamil', 'Telugu', 'Hindi', 'Malayalam', 'Kannada', 'English', 'Korean', 'Japanese', 'Other'];
const types = ['hollywood', 'bollywood', 'kollywood', 'tollywood', 'mollywood', 'korean'];
const statuses = ['Active', 'Coming Soon', 'Hidden'];
const categories = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'Documentary', 'History', 'Sport'];

function Field({ label, required, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      className="bg-zinc-900/70 border border-zinc-800/70 text-zinc-200 placeholder-zinc-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-red-600/70 focus:bg-zinc-900 transition-all w-full"
      {...props}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      className="bg-zinc-900/70 border border-zinc-800/70 text-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-red-600/70 transition-all w-full appearance-none cursor-pointer"
      {...props}
    >
      {children}
    </select>
  );
}

function Textarea({ ...props }) {
  return (
    <textarea
      className="bg-zinc-900/70 border border-zinc-800/70 text-zinc-200 placeholder-zinc-600 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-red-600/70 focus:bg-zinc-900 transition-all w-full resize-none"
      rows={3}
      {...props}
    />
  );
}

export function MovieFormModal({ isOpen, onClose, onSave, editMovie = null }) {
  const isEditing = !!editMovie;
  const [formData, setFormData] = useState(EMPTY_MOVIE);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [posterPreview, setPosterPreview] = useState(null);

  const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

  useEffect(() => {
    if (isOpen) {
      if (editMovie) {
        setFormData({ ...EMPTY_MOVIE, ...editMovie });
        if (editMovie.image) {
          setPosterPreview(`${IMAGE_BASE}${encodeURIComponent(editMovie.image)}`);
        } else {
          setPosterPreview(null);
        }
      } else {
        setFormData({ ...EMPTY_MOVIE, created_at: new Date().toISOString().split('T')[0] });
        setPosterPreview(null);
      }
      setErrors({});
    }
  }, [isOpen, editMovie]);

  const update = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.id.trim()) newErrors.id = 'Movie ID is required';
    if (!formData.year.trim()) newErrors.year = 'Year is required';
    if (!formData.language.trim()) newErrors.language = 'Language is required';
    if (!formData.type.trim()) newErrors.type = 'Type is required';
    if (!formData.status) newErrors.status = 'Status is required';
    return newErrors;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Movie — ${editMovie?.title}` : 'Add New Movie'}
      maxWidth="max-w-4xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left: Poster Preview */}
        <div className="md:col-span-1">
          <Field label="Poster Preview">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/60 flex items-center justify-center relative">
              {posterPreview ? (
                <img
                  src={posterPreview}
                  alt="Poster Preview"
                  className="w-full h-full object-cover"
                  onError={() => setPosterPreview(null)}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-600">
                  <span className="text-4xl">🎬</span>
                  <span className="text-xs">No poster</span>
                </div>
              )}
            </div>
          </Field>

          <div className="mt-3">
            <Field label="Poster File Name" error={errors.image}>
              <Input
                value={formData.image}
                onChange={e => {
                  update('image', e.target.value);
                  setPosterPreview(e.target.value ? `${IMAGE_BASE}${encodeURIComponent(e.target.value)}` : null);
                }}
                placeholder="e.g. Movie Title (2026).jpg"
              />
            </Field>
          </div>
        </div>

        {/* Right: Form Fields */}
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Movie ID" required error={errors.id}>
              <Input
                value={formData.id}
                onChange={e => update('id', e.target.value)}
                placeholder="e.g. hollywood-2026-00001"
              />
            </Field>
            <Field label="Title" required error={errors.title}>
              <Input
                value={formData.title}
                onChange={e => update('title', e.target.value)}
                placeholder="e.g. Avatar (2026)"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Release Date">
              <Input
                value={formData.release}
                onChange={e => update('release', e.target.value)}
                placeholder="e.g. 17 April 2026"
              />
            </Field>
            <Field label="Duration">
              <Input
                value={formData.duration}
                onChange={e => update('duration', e.target.value)}
                placeholder="e.g. 02:15:00 min"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Language" required error={errors.language}>
              <Select value={formData.language} onChange={e => update('language', e.target.value)}>
                {languages.map(l => <option key={l} value={l}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Year" required error={errors.year}>
              <Input
                value={formData.year}
                onChange={e => update('year', e.target.value)}
                placeholder="2026"
              />
            </Field>
            <Field label="Type" required error={errors.type}>
              <Select value={formData.type} onChange={e => update('type', e.target.value)}>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Input
                value={formData.category}
                onChange={e => update('category', e.target.value)}
                placeholder="e.g. Action, Drama, Thriller"
              />
            </Field>
            <Field label="Status" required error={errors.status}>
              <Select value={formData.status} onChange={e => update('status', e.target.value)}>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Director">
            <Input
              value={formData.director}
              onChange={e => update('director', e.target.value)}
              placeholder="Director Name"
            />
          </Field>

          <Field label="Starring">
            <Input
              value={formData.starring}
              onChange={e => update('starring', e.target.value)}
              placeholder="Actor 1, Actor 2, Actor 3"
            />
          </Field>

          <Field label="Story / Synopsis">
            <Textarea
              value={formData.story}
              onChange={e => update('story', e.target.value)}
              placeholder="Brief plot description..."
            />
          </Field>

          <div className="space-y-3 pt-1">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Download Links</p>
            <Field label="360P URL">
              <Input
                value={formData.p360}
                onChange={e => update('p360', e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="720P URL">
              <Input
                value={formData.p720}
                onChange={e => update('p720', e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="1080P URL">
              <Input
                value={formData.p1080}
                onChange={e => update('p1080', e.target.value)}
                placeholder="https://..."
              />
            </Field>
          </div>

          <Field label="Created Date">
            <Input
              type="date"
              value={formData.created_at}
              onChange={e => update('created_at', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-zinc-800/60">
        <Button variant="secondary" onClick={onClose} disabled={saving} icon={X}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving} icon={Save}>
          {isEditing ? 'Save Changes' : 'Create Movie'}
        </Button>
      </div>
    </Modal>
  );
}
