import React, { useEffect } from "react"
import "./Notification.css"

export const Notification: React.FC<any> = ({ message, type = "info", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose?.(), 2800)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-bar" />
      <div className="toast-text">{message}</div>
    </div>
  )
}
