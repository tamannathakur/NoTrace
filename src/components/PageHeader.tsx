
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  backPath?: string;
  actions?: React.ReactNode;
  leftAction?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  showBackButton = true, 
  backPath,
  actions,
  leftAction
}) => {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };
  
  return (
    <div className="flex items-center justify-between border-b bg-card py-2 px-4 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        {leftAction ? (
          leftAction
        ) : (
          showBackButton && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="mr-2">
              <ArrowLeft size={20} />
            </Button>
          )
        )}
        <h1 className="font-bold text-lg">{title}</h1>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
