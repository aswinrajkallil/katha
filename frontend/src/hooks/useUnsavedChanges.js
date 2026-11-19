import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigationGuard } from "../context/NavigationGuardContext";

/**
 * Hook for managing unsaved changes protection on Create/Edit post pages.
 * Handles MobileHeader back button, desktop BackButton, Android hardware back,
 * iOS swipe-back gestures, and tab reloads.
 */
export function useUnsavedChanges({ isDirty, onSaveDraft }) {
  const navigate = useNavigate();
  const { registerGuard } = useNavigationGuard();

  const [showConfirm, setShowConfirm] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const performBack = useCallback(() => {
    const hasInAppHistory = typeof window !== "undefined" && window.history.state?.idx > 0;
    if (hasInAppHistory) {
      navigate(-1);
    } else {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (!isDirty) return;

    // 1. Guard in-app back buttons (mobile header back & desktop BackButton)
    const unregister = registerGuard(() => {
      if (isDirtyRef.current) {
        setShowConfirm(true);
        return true; // Block immediate navigation
      }
      return false;
    });

    // 2. Browser / Android hardware back / iOS swipe popstate interception
    window.history.pushState({ kathaGuard: true }, "");

    const handlePopState = () => {
      if (isDirtyRef.current) {
        // Re-push immediately so we stay on this page while user decides
        window.history.pushState({ kathaGuard: true }, "");
        setShowConfirm(true);
      }
    };

    // 3. Page reload / tab close guard
    const handleBeforeUnload = (e) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unregister();
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, registerGuard]);

  const handleKeepEditing = () => {
    setShowConfirm(false);
  };

  const handleDiscard = () => {
    setShowConfirm(false);
    isDirtyRef.current = false;
    performBack();
  };

  const handleSaveAsDraft = async () => {
    if (typeof onSaveDraft === "function") {
      setSavingDraft(true);
      try {
        const success = await onSaveDraft();
        if (success !== false) {
          setShowConfirm(false);
          isDirtyRef.current = false;
          performBack();
        }
      } finally {
        setSavingDraft(false);
      }
    } else {
      setShowConfirm(false);
      isDirtyRef.current = false;
      performBack();
    }
  };

  const confirmDialogProps = {
    isOpen: showConfirm,
    title: "Unsaved Changes",
    message: "You have unsaved changes. Would you like to save this as a draft, discard your changes, or keep editing?",
    onClose: handleKeepEditing,
    loading: savingDraft,
    danger: false,
    actions: [
      {
        label: savingDraft ? "Saving..." : "Save as draft",
        onClick: handleSaveAsDraft,
        variant: "primary",
        loading: savingDraft,
      },
      {
        label: "Discard",
        onClick: handleDiscard,
        variant: "danger",
        disabled: savingDraft,
      },
      {
        label: "Keep editing",
        onClick: handleKeepEditing,
        variant: "cancel",
        disabled: savingDraft,
      },
    ],
  };

  return {
    showConfirm,
    confirmDialogProps,
    triggerBack: () => {
      if (isDirtyRef.current) {
        setShowConfirm(true);
      } else {
        performBack();
      }
    },
  };
}
