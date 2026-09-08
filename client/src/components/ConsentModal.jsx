import { useState } from "react";
import {
  X,
  ShieldCheck,
  GraduationCap,
  Users,
  Check,
  LockKeyhole,
  ArrowRight,
} from "lucide-react";

export default function ConsentModal({ onAgree, onClose }) {
  const [agreed, setAgreed] = useState(false);

  const handleAgree = () => {
    if (!agreed) return;
    onAgree();
  };

  return (
    <div
      className="
        fixed
        inset-0
        z-[9999]
        flex
        items-center
        justify-center
        bg-slate-900/60
        px-3
        py-3
        backdrop-blur-sm

        sm:px-5
        sm:py-5

        lg:px-6
        lg:py-6
      "
    >
      {/* =====================================================
          MODAL
      ====================================================== */}

      <div
        className="
          relative
          flex
          w-full
          max-w-[620px]
          flex-col
          overflow-hidden
          rounded-2xl
          bg-white
          shadow-2xl

          /* Mobile */
          max-h-[calc(100dvh-24px)]

          /* Tablet */
          sm:max-w-[580px]
          sm:max-h-[calc(100dvh-40px)]

          /* Laptop */
          lg:max-w-[620px]
          lg:max-h-[calc(100dvh-48px)]

          /* Large screens */
          xl:max-w-[640px]
        "
      >
        {/* =====================================================
            CLOSE BUTTON
        ====================================================== */}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close consent"
          className="
            absolute
            right-3
            top-3
            z-30
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-full
            text-slate-400
            transition
            hover:bg-slate-100
            hover:text-slate-700

            sm:right-4
            sm:top-4
            sm:h-9
            sm:w-9
          "
        >
          <X size={19} />
        </button>

        {/* =====================================================
            SCROLLABLE CONTENT
        ====================================================== */}

        <div className="overflow-y-auto overscroll-contain">

          {/* ===================================================
              HEADER
          ==================================================== */}

          <div
            className="
              px-5
              pt-5

              sm:px-7
              sm:pt-5

              lg:px-8
              lg:pt-6
            "
          >
            <div className="flex items-center gap-2.5">
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  bg-brand-600
                  text-white

                  sm:h-10
                  sm:w-10
                "
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M8 5L19 12L8 19V5Z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              <div>
                <h2
                  className="
                    text-lg
                    font-bold
                    leading-none
                    text-slate-900

                    sm:text-xl
                  "
                >
                  Medi<span className="text-brand-600">Share</span>
                </h2>

                <p className="mt-1 text-[8px] text-slate-400 sm:text-[9px]">
                  Knowledge today. Healthier tomorrow.
                </p>
              </div>
            </div>
          </div>

          {/* ===================================================
              DOCTOR IMAGE

              MOBILE:
              hidden

              TABLET / LAPTOP:
              visible
          ==================================================== */}

          <div
            className="
              hidden
              justify-center
              sm:flex
              sm:mt-1
              lg:mt-2
            "
          >
            <img
              src="/consent-doctor.png"
              alt="Doctor sharing educational video"
              className="
                h-[90px]
                w-[280px]
                object-contain

                md:h-[95px]
                md:w-[300px]

                lg:h-[105px]
                lg:w-[340px]
              "
            />
          </div>

          {/* ===================================================
              MOBILE TOP SPACING

              Since image is removed on mobile, give the
              heading a little breathing room.
          ==================================================== */}

          <div className="mt-5 sm:hidden" />

          {/* ===================================================
              TITLE
          ==================================================== */}

          <div
            className="
              px-5
              text-center

              sm:px-7

              lg:px-8
            "
          >
            <h1
              className="
                text-[21px]
                font-bold
                leading-tight
                text-slate-900

                sm:text-[23px]

                lg:text-[25px]
              "
            >
              Video Sharing Consent
            </h1>

            <p
              className="
                mx-auto
                mt-1.5
                max-w-[500px]
                text-[10px]
                leading-4
                text-slate-500

                sm:text-[11px]
                sm:leading-5

                lg:text-xs
              "
            >
              At MediShare, your expertise helps educate and empower
              patients with reliable medical information.
            </p>
          </div>

          {/* ===================================================
              BENEFITS

              Mobile:
              1 column

              Tablet + Laptop:
              3 columns
          ==================================================== */}

          <div
            className="
              mx-4
              mt-4
              rounded-xl
              bg-brand-50
              px-3
              py-3

              sm:mx-6
              sm:mt-4
              sm:px-2
              sm:py-3

              lg:mx-8
              lg:mt-4
              lg:px-3
              lg:py-3.5
            "
          >
            <div
              className="
                grid
                grid-cols-1

                sm:grid-cols-3
              "
            >
              {/* =================================================
                  PATIENT EDUCATION
              ================================================== */}

              <div
                className="
                  flex
                  items-center
                  gap-3
                  px-1
                  py-2

                  sm:flex-col
                  sm:border-r
                  sm:border-brand-100
                  sm:px-3
                  sm:py-1
                  sm:text-center
                "
              >
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-white
                    text-brand-600
                    shadow-sm

                    sm:h-10
                    sm:w-10
                  "
                >
                  <GraduationCap size={18} />
                </div>

                <div>
                  <h3
                    className="
                      text-[10px]
                      font-semibold
                      text-slate-900

                      sm:text-[11px]
                    "
                  >
                    Patient Education
                  </h3>

                  <p
                    className="
                      mt-0.5
                      max-w-[180px]
                      text-[9px]
                      leading-3.5
                      text-slate-500

                      sm:mt-1
                      sm:mx-auto
                    "
                  >
                    Your videos will be used for patient education
                    purposes.
                  </p>
                </div>
              </div>

              {/* =================================================
                  RESPONSIBLE USE
              ================================================== */}

              <div
                className="
                  flex
                  items-center
                  gap-3
                  border-t
                  border-brand-100
                  px-1
                  py-2

                  sm:flex-col
                  sm:border-r
                  sm:border-t-0
                  sm:px-3
                  sm:py-1
                  sm:text-center
                "
              >
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-white
                    text-brand-600
                    shadow-sm

                    sm:h-10
                    sm:w-10
                  "
                >
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <h3
                    className="
                      text-[10px]
                      font-semibold
                      text-slate-900

                      sm:text-[11px]
                    "
                  >
                    Safe & Responsible Use
                  </h3>

                  <p
                    className="
                      mt-0.5
                      max-w-[180px]
                      text-[9px]
                      leading-3.5
                      text-slate-500

                      sm:mt-1
                      sm:mx-auto
                    "
                  >
                    Your content is used in a professional and
                    respectful manner.
                  </p>
                </div>
              </div>

              {/* =================================================
                  GREATER IMPACT
              ================================================== */}

              <div
                className="
                  flex
                  items-center
                  gap-3
                  border-t
                  border-brand-100
                  px-1
                  py-2

                  sm:flex-col
                  sm:border-t-0
                  sm:px-3
                  sm:py-1
                  sm:text-center
                "
              >
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-white
                    text-brand-600
                    shadow-sm

                    sm:h-10
                    sm:w-10
                  "
                >
                  <Users size={18} />
                </div>

                <div>
                  <h3
                    className="
                      text-[10px]
                      font-semibold
                      text-slate-900

                      sm:text-[11px]
                    "
                  >
                    Greater Impact
                  </h3>

                  <p
                    className="
                      mt-0.5
                      max-w-[180px]
                      text-[9px]
                      leading-3.5
                      text-slate-500

                      sm:mt-1
                      sm:mx-auto
                    "
                  >
                    Help reach more patients and create awareness
                    about better health.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ===================================================
              CONSENT CHECKBOX
          ==================================================== */}

          <div
            className="
              mx-4
              mt-3
              rounded-xl
              bg-slate-50
              p-3

              sm:mx-6
              sm:mt-4
              sm:p-3.5

              lg:mx-8
            "
          >
            <label className="flex cursor-pointer items-start gap-2.5">
              {/* Custom checkbox */}

              <button
                type="button"
                onClick={() => setAgreed((value) => !value)}
                aria-label="Agree to video sharing consent"
                className={`
                  mt-0.5
                  flex
                  h-[18px]
                  w-[18px]
                  shrink-0
                  items-center
                  justify-center
                  rounded-[4px]
                  border
                  transition

                  sm:h-5
                  sm:w-5

                  ${
                    agreed
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-300 bg-white"
                  }
                `}
              >
                {agreed && (
                  <Check
                    size={13}
                    strokeWidth={3}
                  />
                )}
              </button>

              <span
                onClick={() => setAgreed((value) => !value)}
                className="
                  text-[10px]
                  font-medium
                  leading-4
                  text-slate-800

                  sm:text-[11px]
                  sm:leading-4
                "
              >
                I consent to recording and using my video for patient
                education purposes through MediShare.
              </span>
            </label>

            <p
              className="
                ml-[27px]
                mt-1
                text-[8px]
                leading-3.5
                text-slate-400

                sm:text-[9px]
                sm:leading-3.5
              "
            >
              I confirm that I have the necessary rights and permissions
              to share this content and understand that my video may be
              stored, processed, and made available on MediShare for
              educational use.
            </p>
          </div>

          {/* ===================================================
              ACTIONS
          ==================================================== */}

          <div
            className="
              px-4
              pb-4
              pt-3

              sm:px-6
              sm:pb-4
              sm:pt-3

              lg:px-8
              lg:pb-5
            "
          >
            <div className="flex gap-2.5">

              {/* =============================================
                  CANCEL

                  Mobile: hidden
                  Tablet/Desktop: visible
              ============================================== */}

              <button
                type="button"
                onClick={onClose}
                className="
                  hidden
                  h-9
                  flex-1
                  rounded-lg
                  border
                  border-brand-600
                  bg-white
                  text-xs
                  font-semibold
                  text-brand-600
                  transition
                  hover:bg-brand-50

                  sm:block
                "
              >
                Cancel
              </button>

              {/* =============================================
                  AGREE
              ============================================== */}

              <button
                type="button"
                onClick={handleAgree}
                disabled={!agreed}
                className="
                  flex
                  h-9
                  w-full
                  items-center
                  justify-center
                  gap-1.5
                  rounded-lg
                  bg-brand-600
                  text-xs
                  font-semibold
                  text-white
                  transition
                  hover:bg-brand-700
                  disabled:cursor-not-allowed
                  disabled:bg-slate-300

                  sm:flex-1
                "
              >
                I Agree & Continue

                <ArrowRight size={14} />
              </button>
            </div>

            {/* Footer */}

            <div
              className="
                mt-2.5
                flex
                items-center
                justify-center
                gap-1.5
                text-center
                text-[8px]
                text-slate-400

                sm:mt-3
                sm:text-[9px]
              "
            >
              <LockKeyhole size={10} />

              <span>
                Your consent is required to upload a video.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}