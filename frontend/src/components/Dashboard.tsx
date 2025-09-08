import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  const stats = [
    { 
      name: 'Total Sites', 
      value: '12', 
      icon: '🏗️',
      description: 'Active construction sites'
    },
    { 
      name: 'Total Workers', 
      value: '234', 
      icon: '👷',
      description: 'Registered workers'
    },
    { 
      name: 'Today\'s Attendance', 
      value: '187', 
      icon: '📋',
      description: 'Workers present today'
    },
    { 
      name: 'Pending Approvals', 
      value: '5', 
      icon: '⏳',
      description: 'Attendance records pending review'
    },
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'attendance',
      message: 'Attendance submitted for Construction Site Alpha',
      user: 'John Foreman',
      time: '2 hours ago',
    },
    {
      id: 2,
      type: 'approval',
      message: 'Attendance approved for 25 workers',
      user: 'Sarah Supervisor',
      time: '4 hours ago',
    },
    {
      id: 3,
      type: 'worker',
      message: 'New worker registered: Rajesh Kumar',
      user: 'Mike Manager',
      time: '6 hours ago',
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {user?.name}!
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome to the Hajiri Attendance Management System
          </p>
          <div className="mt-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {user?.role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-2xl">{stat.icon}</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stat.value}
                    </dd>
                    <dd className="text-sm text-gray-500">
                      {stat.description}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Activity
            </h3>
            <div className="mt-5">
              <div className="flow-root">
                <ul className="-mb-8">
                  {recentActivity.map((activity, activityIdx) => (
                    <li key={activity.id}>
                      <div className="relative pb-8">
                        {activityIdx !== recentActivity.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                              {activity.type === 'attendance' && '📋'}
                              {activity.type === 'approval' && '✅'}
                              {activity.type === 'worker' && '👷'}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                {activity.message}{' '}
                                <span className="font-medium text-gray-900">
                                  by {activity.user}
                                </span>
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              <time>{activity.time}</time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Quick Actions
            </h3>
            <div className="mt-5">
              <div className="grid grid-cols-1 gap-3">
                <button className="relative group bg-white p-3 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📝</span>
                    <div className="text-left">
                      <h4 className="text-sm font-medium text-gray-900">
                        Submit Attendance
                      </h4>
                      <p className="text-sm text-gray-500">
                        Record worker attendance for today
                      </p>
                    </div>
                  </div>
                </button>

                {(user?.role === 'SITE_INCHARGE' || user?.role === 'ADMIN') && (
                  <button className="relative group bg-white p-3 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">✅</span>
                      <div className="text-left">
                        <h4 className="text-sm font-medium text-gray-900">
                          Review Attendance
                        </h4>
                        <p className="text-sm text-gray-500">
                          Approve pending attendance records
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {user?.role === 'ADMIN' && (
                  <button className="relative group bg-white p-3 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">👤</span>
                      <div className="text-left">
                        <h4 className="text-sm font-medium text-gray-900">
                          Manage Users
                        </h4>
                        <p className="text-sm text-gray-500">
                          Add or edit system users
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                <button className="relative group bg-white p-3 rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📊</span>
                    <div className="text-left">
                      <h4 className="text-sm font-medium text-gray-900">
                        View Reports
                      </h4>
                      <p className="text-sm text-gray-500">
                        Generate attendance reports
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
