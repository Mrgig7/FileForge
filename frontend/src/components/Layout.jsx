import Sidebar from './Sidebar';
import Topbar from './Topbar';
import DashboardScene from './3d/DashboardScene';

const Layout = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden text-foreground font-sans selection:bg-indigo-500/30">
      {/* 3D Background Layer */}
      <div className="fixed inset-0 z-0">
        <DashboardScene />
      </div>

      {/* UI Layer */}
      <div className="relative z-10 flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300">
          <Topbar />
          <main className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
