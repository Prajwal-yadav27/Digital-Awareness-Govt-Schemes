import { useNavigate } from 'react-router-dom';

const BackButton = ({ label = '← Back', onClick, to }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };
  return (
    <button
      type="button"
      className="btn-secondary btn-back"
      onClick={handleClick}
      aria-label="Go back"
    >
      {label}
    </button>
  );
};

export default BackButton;
