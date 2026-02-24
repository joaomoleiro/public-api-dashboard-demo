import { React, useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import axios from 'axios';

// Constants
const API_BASE_URL = '/dashlane-api/public/teams';
const AUTH_TOKEN = process.env.REACT_APP_DASHLANE_API_KEY

// API client
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
});

// Utility functions
const getUserRole = (role) => {
  if (role.teamAdmin) return 'Admin';
  if (role.groupManager) return 'Group Manager';
  if (role.billingAdmin) return 'Billing Admin';
  return 'User';
};

const getScoreColor = (score) => {
  if (score >= 0.8) return 'green';
  if (score >= 0.6) return 'orange';
  return 'red';
};

// Components
const App = () => {
  const [dashlaneInfo, setDashlaneInfo] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const fetchDashlaneInfo = async () => {
      setHasError(false);
      try {
        const [team, healthscore, users] = await Promise.all([
          api.post('/Status'),
          api.post('/PasswordHealth'),
          api.post('/Members', {
            page: 0,
            order: 'ASC',
            orderBy: 'email',
            limit: 100
          })
        ]);

        setDashlaneInfo({
          team: team.data.data,
          healthscore: [...healthscore.data.data.history, healthscore.data.data.current],
          users: users.data.data
        });
      } catch (error) {
        setHasError(true);
        console.error('Failed to fetch Dashlane info:', error);
      }
    };

    fetchDashlaneInfo();
  }, []);

  if (hasError) {
    return <div>Failed to fetch Dashlane info</div>;
  } else if (!dashlaneInfo) {
    return <div>Loading...</div>
  }

  return <Body dashlaneInfo={dashlaneInfo} />
};

const Body = ({ dashlaneInfo }) => {
  const [userDevices, setUserDevices] = useState(null);
  const [activeUser, setActiveUser] = useState(null);

  useEffect(() => {
    const fetchUserDevice = async () => {
      if (!activeUser) return;
      
      try {
        const response = await api.post('/MembersDeviceInformation', {
          emails: [activeUser]
        });
        setUserDevices(response.data.data.devices);
      } catch (error) {
        console.error('Failed to fetch user devices:', error);
      }
    };

    fetchUserDevice();
  }, [activeUser]);

  return (
    <div className="flex">
      <div className="flex w-full">
        <div className="h-screen flex-grow overflow-x-hidden overflow-auto flex flex-wrap content-start p-2">
          <UsersInfo users={dashlaneInfo.users} setActiveUser={setActiveUser} />
          <ScoreDetails healthscore={dashlaneInfo.healthscore} />
          <div className="flex flex-wrap lg:w-1/2">
            <SeatsTaken team={dashlaneInfo.team} />
            <PendingInvitations team={dashlaneInfo.team} />
            <DevicesInfo userDevices={userDevices} />
          </div>
        </div>
      </div>
    </div>
  );
};

const UserDevice = ({ device }) => (
  <tr>
    <td>
      <div className="user__info">
        <div className="name">
          <p>{device.name}</p>
          <span className="type type--invited">{device.platform}</span>
        </div>
      </div>
    </td>
    <td><p className="user__metric">{device.appVersion || "-"}</p></td>
    <td><p className="user__metric">{device.model || "-"}</p></td>
    <td><p className="user__metric">{device.osVersion || "-"}</p></td>
  </tr>
);

const DevicesInfo = ({ userDevices }) => {
  if (!userDevices) return null;

  return (
    <div className="p-3 lg:w-full">
      <div className="bg-card">
        <table className="users__table">
          <thead>
            <tr>
              <th width="50%">Device</th>
              <th width="10%">Dashlane version</th>
              <th width="10%">Device Model</th>
              <th width="10%">Device OS version</th>
            </tr>
          </thead>
          <tbody>
            {userDevices.map((device, i) => (
              <UserDevice key={i} device={device} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const UserProfile = ({ user, setActiveUser }) => {
  const auth_type = user.authentication.type === "email_token" ? "Email token" : "-";
  const status = user.status === 'accepted' ? 'Dashlane user' : user.status;
  const role = getUserRole(user.role);

  return (
    <tr>
      <td>
        <div className="user__info">
          <div className="name">
            <p>{user.email}</p>
            <span className={`type ${user.status === 'accepted' ? 'type--invited' : 'type--not_invited'}`}>
              {status}
            </span>
          </div>
        </div>
      </td>
      <td><p className="user__metric user__metric--score">{user.passwordHealth.score || "-"}</p></td>
      <td><p className="user__metric user__metric--weak">{user.passwordHealth.weakPasswords || "-"}</p></td>
      <td><p className="user__metric user__metric--compromised">{user.passwordHealth.compromisedPasswords || "-"}</p></td>
      <td><p className="user__metric">{auth_type}</p></td>
      <td><p className="user__metric">{role}</p></td>
      <td>
        {user.status === 'accepted' && (
          <button className="user__button" onClick={() => setActiveUser(user.email)}>
            <Icon name="action" />
          </button>
        )}
      </td>
    </tr>
  );
};

const UsersInfo = ({ users, setActiveUser }) => (
  <div className="p-3 lg:w-full">
    <div className="bg-card">
      <h2>Users</h2>
      <table className="users__table">
        <thead>
          <tr>
            <th width="50%">Email</th>
            <th>Health Score</th>
            <th>Weak logins</th>
            <th>Compromised logins</th>
            <th>Authentication</th>
            <th>Role</th>
            <th>Devices</th>
          </tr>
        </thead>
        <tbody>
          {users.members.map((user, i) => (
            <UserProfile key={i} user={user} setActiveUser={setActiveUser} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const SeatsTaken = ({ team }) => (
  <div className="p-3 lg:w-1/2">
    <div className="bg-card card-small">
      <h3>Seats taken</h3>
      <div className="metric__highlight">
        <p className="metric__highlight-text">
          {team.seats.active}/{team.seats.remaining + team.seats.active}
        </p>
      </div>
    </div>
  </div>
);

const PendingInvitations = ({ team }) => (
  <div className="p-3 lg:w-1/2">
    <div className="bg-card card-small">
      <h3>Pending invitations</h3>
      <div className="metric__highlight">
        <p className="metric__highlight-text">{team.seats.pending}</p>
      </div>
    </div>
  </div>
);

const CustomizedAxisTick = ({ x, y, index, payload }) => {
  const label = payload.value || 'Now';
  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={8} 
        textAnchor={label === 'Now' ? "end" : "start"} 
        fill="#96A7B0"
      >
        {label}
      </text>
    </g>
  );
};

const ScoreDetails = ({ healthscore }) => (
  <div className="p-3 lg:w-1/2">
    <div className="bg-card">
      <div className="flex flex-col">
        <h2>Password Health Score details</h2>
        <div className="graph_label">Company score over time</div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={healthscore}>
          <CartesianGrid
            horizontal={true}
            strokeWidth="1"
            stroke="rgba(98, 114, 128, 0.50)"
          />
          <XAxis
            dataKey="name"
            axisLine={true}
            tickMargin={8}
            tick={<CustomizedAxisTick />}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tickMargin={8} 
            domain={[0,100]} 
            tickCount={10} 
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="rgba(12, 125, 140, 0.85)"
            strokeWidth="2"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="divider" />
      <HealthScoreDetails healthscore={healthscore} />
    </div>
  </div>
);

const HealthScoreDetails = ({ healthscore }) => {
  const currentScore = healthscore[healthscore.length - 1];
  const score = currentScore.score / 100;
  const scoreColor = getScoreColor(score);

  return (
    <div className="flex score__details">
      <div className="details__metric-score">
        <h4>Password Health Score</h4>
        <div className="flex items-center">
          <span className={`text--${scoreColor}`}><Icon name="score" /></span>
          <p>{score.toLocaleString("en", {style: "percent"})}</p>
        </div>
      </div>
      <div className="divider -vertical" />
      <div className="details__metrics flex flex-row">
        <div className="detail">
          <h4>Total logins</h4>
          <p>{currentScore.passwordsTotal}</p>
        </div>
        <div className="detail">
          <h4>Safe</h4>
          <p className="text--green">{currentScore.safe}</p>
        </div>
        <div className="detail">
          <h4>Weak</h4>
          <p className="text--orange">{currentScore.weak}</p>
        </div>
        <div className="detail">
          <h4>Reused</h4>
          <p className="text--orange">{currentScore.reused}</p>
        </div>
        <div className="detail">
          <h4>Compromised</h4>
          <p className="text--red">{currentScore.compromised}</p>
        </div>
      </div>
    </div>
  );
};

const Icon = ({ name }) => {
  if (name === 'action') {
    return  <svg viewBox="0 0 24 24" class="metric__icon icon__small text--white" xmlns="http://www.w3.org/2000/svg" ><path d="M14 12a2 2 0 0 1-.1.627l1.493 1.493a4 4 0 1 0-1.45 1.378l-1.54-1.539A2 2 0 1 1 14 12Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="m10.103 2-.807 3.058c-.09.037-.18.075-.27.116l-2.77-1.572-2.654 2.654L5.153 8.99a7.854 7.854 0 0 0-.135.32L2 10.13v3.788l3.051.806c.038.094.078.187.119.277l-1.568 2.765 2.654 2.654L8.99 18.87c.106.047.213.093.321.136L10.133 22h3.784l.805-3.022c.098-.038.195-.077.291-.119l2.754 1.562 2.654-2.654-1.558-2.747c.043-.1.083-.202.122-.304L22 13.89v-3.785l-3.039-.808a6.038 6.038 0 0 0-.118-.258l1.578-2.782-2.654-2.654L15.02 5.16c-.1-.043-.2-.083-.302-.121L13.89 2h-3.788ZM8.455 7.148c.05.029.102.053.155.072.27.116.59.111.87-.04a5.85 5.85 0 0 1 .961-.414l.517-.169L11.644 4h.718l.713 2.617.535.158c.348.103.686.238 1.01.404a1 1 0 0 0 1.067-.098l1.742-.988.501.5-1.055 1.862.009.005a.998.998 0 0 0-.112.853l.066.203.043.08c.177.328.273.532.376.846l.168.515 2.575.685v.722l-2.595.712-.157.533a5.845 5.845 0 0 1-.404 1.01 1 1 0 0 0 .098 1.068l.988 1.743-.5.5-1.697-.962a1 1 0 0 0-1.12-.132c-.324.17-.662.308-1.01.414l-.533.162L12.38 20h-.721l-.529-1.928a1 1 0 0 0-.87-.847 5.852 5.852 0 0 1-.837-.37 1 1 0 0 0-1.088.088l-1.741.987-.501-.5.963-1.699a.996.996 0 0 0 .245-.655v-.284l-.114-.218a5.497 5.497 0 0 1-.414-.972l-.162-.534L4 12.379v-.718l2.078-.565-.014-.053c.376-.095.667-.404.737-.79a5.85 5.85 0 0 1 .368-.83 1 1 0 0 0-.091-1.092l-.985-1.736.5-.5 1.862 1.054Z"></path></svg>
  } else {
    return <svg viewBox="0 0 32 32" class="metric__icon" xmlns="http://www.w3.org/2000/svg"><path d="M4.95938 8.35194L16 4.90176L27.0405 8.35194C26.9341 9.29222 26.7718 10.5445 26.5397 11.9122C26.0316 14.9058 25.2445 18.0903 24.1647 19.9124C23.5509 20.9481 22.5597 22.012 21.4175 23.0176L22.9289 24.529C24.1514 23.4408 25.2661 22.2384 26 21C28.6035 16.6066 29.3333 6.83335 29.3333 6.83335L16 2.66669L2.66663 6.83335C2.66663 6.83335 3.39646 16.6066 5.99996 21C8.60346 25.3934 16 29.3334 16 29.3334C16 29.3334 18.0737 28.2287 20.4115 26.5371L18.8826 25.0082C18.853 25.0292 18.8234 25.0502 18.7938 25.071C17.7614 25.7994 16.803 26.3995 16.1032 26.8171L16 26.8785L15.8967 26.8171C15.1969 26.3995 14.2386 25.7994 13.2061 25.071C11.0678 23.5625 8.89197 21.6957 7.83525 19.9124C6.75546 18.0903 5.96831 14.9058 5.46024 11.9122C5.22811 10.5445 5.06584 9.29222 4.95938 8.35194Z"/><path d="M20.4632 11.088L15.2134 16.5138L13.0091 14.1704L11.4552 15.6321L15.1916 19.6043L21.9963 12.5715L20.4632 11.088Z"/></svg>
  }
}

export default App;
