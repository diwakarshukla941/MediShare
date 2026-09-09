import { useState } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  Link2,
  Share2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";

import Logo from "../components/Logo.jsx";
import VideoDropzone from "../components/VideoDropzone.jsx";
import CopyLinkField from "../components/CopyLinkField.jsx";
import ConsentModal from "../components/ConsentModal.jsx";
import { api, getErrorMessage } from "../lib/api.js";

const initialForm = {
  doctorName: "",
  degree: "",
  specialization: "",
  organizationName: "",
  phone: "",
  email: "",
};

export default function PublicUpload() {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  // Consent
  const [hasConsent, setHasConsent] = useState(false);
  const [showConsent, setShowConsent] = useState(true);

  const update = (key) => (e) => {
    setForm((f) => ({
      ...f,
      [key]: e.target.value,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();

    // ---------------------------------------
    // Consent protection
    // ---------------------------------------

    if (!hasConsent) {
      setShowConsent(true);
      toast.error("Please provide consent before uploading a video");
      return;
    }

    // ---------------------------------------
    // File validation
    // ---------------------------------------

    if (!file) {
      toast.error("Please select a video to upload");
      return;
    }

    const data = new FormData();

    data.append("video", file);

    Object.entries(form).forEach(([k, v]) => {
      data.append(k, v);
    });

    // Consent information
    data.append("consent", "true");
    data.append("consentVersion", "1.0");

    setUploading(true);
    setProgress(0);

    try {
      const { data: res } = await api.post("/videos", data, {
        onUploadProgress: (evt) => {
          if (evt.total) {
            setProgress(
              Math.round((evt.loaded * 100) / evt.total)
            );
          }
        },
      });

      setResult({
        url: `${window.location.origin}${res.watchPath}`,
      });

      toast.success("Video uploaded successfully");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  // =========================================
  // SUCCESS PAGE
  // =========================================

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={28} />
          </span>

          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Video Uploaded!
          </h1>

          <p className="mt-1.5 text-sm text-slate-500">
            Share this link with your patients so they can watch it.
          </p>

          <div className="mt-6">
            <CopyLinkField url={result.url} />
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              Preview Video
            </a>

            <button
              className="btn-primary"
              onClick={() => {
                setResult(null);
                setFile(null);
                setForm(initialForm);

                // Require consent again
                setHasConsent(false);
                setShowConsent(true);
              }}
            >
              Upload Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================
  // UPLOAD PAGE
  // =========================================

  return (
    <>
      {/* =====================================
          CONSENT MODAL
      ====================================== */}

      {showConsent && (
        <ConsentModal
          onAgree={() => {
            setHasConsent(true);
            setShowConsent(false);
          }}
          onClose={() => {
            // X / Cancel does NOT grant consent
            setShowConsent(false);
          }}
        />
      )}

      <div className="min-h-screen bg-slate-50">

        {/* ===================================
            HEADER
        ==================================== */}

        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 sm:px-10">
          <Logo />

          <Link
            to="/login"
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Dashboard Login
          </Link>
        </header>

        {/* ===================================
            MAIN
        ==================================== */}

        <main className="mx-auto max-w-lg px-4 py-12">

          {/* Heading */}

          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <UploadCloud size={22} />
            </span>

            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              Upload Your Video
            </h1>

            <p className="mt-1.5 text-sm text-slate-500">
              Share educational videos with patients easily.
            </p>
          </div>

          {/* ===================================
              CONSENT REQUIRED
          ==================================== */}

          {!hasConsent && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">

                <div className="mt-0.5 text-amber-600">
                  <ShieldAlert size={19} />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Consent Required
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    You must agree to the video sharing consent
                    before you can upload a video.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowConsent(true)}
                    className="mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Review Consent →
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ===================================
              UPLOAD FORM
          ==================================== */}

          <div className="relative">

            <form
              onSubmit={submit}
              className={`
                card mt-8 space-y-5 p-6 transition
                ${!hasConsent ? "opacity-50" : ""}
              `}
            >
              {/* Video */}

              <VideoDropzone
                file={file}
                onChange={setFile}
                maxSizeMB={500}
                disabled={!hasConsent || uploading}
              />

              {/* Doctor information */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                {/* Doctor Name */}

                <div>
                  <label className="label">
                    Doctor Name
                  </label>

                  <input
                    className="input"
                    required
                    disabled={!hasConsent}
                    placeholder="Diwakar Shukla"
                    value={form.doctorName}
                    onChange={update("doctorName")}
                  />
                </div>

                {/* Degree */}

                <div>
                  <label className="label">
                    Degree
                  </label>

                  <input
                    className="input"
                    required
                    disabled={!hasConsent}
                    placeholder="e.g. MBBS, BHMS"
                    value={form.degree}
                    onChange={update("degree")}
                  />
                </div>

                {/* Specialization */}

                <div>
                  <label className="label">
                    Specialization (Optional)
                  </label>

                  <input
                    className="input"
                    disabled={!hasConsent}
                    placeholder="e.g. General Physician"
                    value={form.specialization}
                    onChange={update("specialization")}
                  />
                </div>

                {/* Phone */}

                <div>
                  <label className="label">
                    Phone Number
                  </label>

                  <input
                    className="input"
                    type="tel"
                    required
                    disabled={!hasConsent}
                    placeholder="e.g. +91 12345 67890"
                    value={form.phone}
                    onChange={update("phone")}
                  />
                </div>

                {/* Email */}

                <div>
                  <label className="label">
                    Email
                  </label>

                  <input
                    className="input"
                    type="email"
                    required
                    disabled={!hasConsent}
                    placeholder="e.g. doctor@clinic.com"
                    value={form.email}
                    onChange={update("email")}
                  />
                </div>

                {/* Organization */}

                <div>
                  <label className="label">
                    Organization Name (Optional)
                  </label>

                  <input
                    className="input"
                    disabled={!hasConsent}
                    placeholder="e.g. MediCare Clinic"
                    value={form.organizationName}
                    onChange={update("organizationName")}
                  />
                </div>

              </div>

              {/* Progress */}

              {uploading && (
                <div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-brand-600 transition-all"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <p className="mt-1.5 text-xs text-slate-500">
                    Uploading... {progress}%
                  </p>
                </div>
              )}

              {/* Upload */}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={uploading || !hasConsent}
              >
                {uploading
                  ? "Uploading..."
                  : !hasConsent
                    ? "Consent Required"
                    : "Upload Video"}
              </button>
            </form>

            {/* Extra protection over entire form */}

            {!hasConsent && (
              <div
                className="absolute inset-0 z-10 mt-8 rounded-xl"
                onClick={() => setShowConsent(true)}
                aria-hidden="true"
              />
            )}
          </div>

          {/* ===================================
              HOW IT WORKS
          ==================================== */}

          <div className="card mt-6 p-6">
            <h2 className="text-sm font-semibold text-slate-900">
              How it works?
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">

              <Step
                icon={UploadCloud}
                title="1. Upload"
                desc="Upload your video with details."
              />

              <Step
                icon={Link2}
                title="2. Get Link"
                desc="We generate a secure link for your video."
              />

              <Step
                icon={Share2}
                title="3. Share"
                desc="Share the link with your patients anywhere."
              />

            </div>

            <p className="mt-4 text-center text-xs text-slate-400">
              Your video will be available to anyone with the link.
            </p>
          </div>

        </main>
      </div>
    </>
  );
}

// =========================================
// STEP COMPONENT
// =========================================

function Step({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon size={18} />
      </span>

      <p className="mt-2 text-xs font-semibold text-slate-800">
        {title}
      </p>

      <p className="mt-0.5 text-xs text-slate-400">
        {desc}
      </p>
    </div>
  );
}