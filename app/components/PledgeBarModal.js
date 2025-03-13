import ActionModal from './ActionModal';

const PledgeBarModal = ({ isOpen, onClose, isSignedIn }) => {
  const modalProps = isSignedIn ? {
    message: "⚡️ Donations aren't built yet! Please support us on OpenCollective so we can get this built!⚡️",
    primaryActionLabel: "Visit",
    primaryActionHref: "https://opencollective.com/wewrite-app/contribute/backer-77100"
  } : {
    message: "To donate, you must sign in!",
    primaryActionLabel: "Sign in",
    primaryActionHref: "/signin"
  };

  return (
    <ActionModal
      isOpen={isOpen}
      onClose={onClose}
      {...modalProps}
    />
  );
};

export default PledgeBarModal; 