function str(task) {
  const main = `${task.description} every ${task.frequency} ${task.unit} for ${task.restrictions.len} minute(s) on ${task.restrictions.tow} between ${task.restrictions.start} and ${task.restrictions.end}`;
  return main;
}
const getToDFromTimestamp = (timestamp) => {
  const timestampDate = new Date(timestamp);
  const timestampHours = timestampDate.getHours();
  const timestampMinutes = timestampDate.getMinutes();
  return [timestampHours, timestampMinutes];
};

const isTimestampBetween = (startTime, endTime, timestamp, len, lookAhead) => {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  const [timestampHours, timestampMinutes] = getToDFromTimestamp(timestamp);

  // Convert times to total minutes for easier comparison
  const startTotalMinutes = startHours * 60 + startMinutes + (lookAhead?-60:0);
  const endTotalMinutes = endHours * 60 + endMinutes;
  const timestampTotalMinutes = timestampHours * 60 + timestampMinutes;
  const timestampTotalMinutesEnd = timestampHours * 60 + timestampMinutes + len;

  return (
    timestampTotalMinutes >= startTotalMinutes &&
    timestampTotalMinutesEnd <= endTotalMinutes
  );
};

const isWeekend = (timestamp) => {
  const date = new Date(timestamp);
  const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  return dayOfWeek === 0 || dayOfWeek === 6; // Check if it's Sunday or Saturday
};

const canDoTow = (task, time)=>{
  if (task.restrictions.tow === "any day") { return true 
  } else if (task.restrictions.tow === "weekends") {
    return isWeekend(time) 
  } else if (task.restrictions.tow === "weekdays") {
    return !isWeekend(time) 
  }
}

const canDo = (task, time, lookAhead) => {

    return canDoTow(task, time) && isTimestampBetween(
      task.restrictions.start,
      task.restrictions.end,
      time,
      task.restrictions.len,
      lookAhead
    );
};

function getMultiplierForUnit(unit) {
  switch (unit) {
    case "minute":
      return 1;
    case "hour":
      return 60;
    case "day":
      return 60 * 24;
    case "week":
      return 60 * 24 * 7;
    case "month":
      return 60 * 24 * 30;
    case "year":
      return 60 * 24 * 365;
    default:
      console.error("Unknown unit:", unit);
      return 1;
  }
}
function getTaskLengthInTicks(task){
  return parseInt(task.restrictions.len) *
  getMultiplierForUnit("minute") *
  60 *
  1000;
}
function calculateTaskDifficulty(task, maxTaskLength) {
  const minMaxTaskLength = 1 * 60 * 60 * 1000; // 4 hours in milliseconds
  maxTaskLength = Math.max(maxTaskLength  , minMaxTaskLength)
  const taskLength = getTaskLengthInTicks(task);

  // Calculate difficulty using a logarithmic scale
  const difficulty =
    Math.pow(Math.log(taskLength + 1) / Math.log(maxTaskLength + 1), 5);
  return difficulty;
}

const frequencyInMinutes = (task) => {
  const { frequency, unit } = task;

  return parseInt(frequency) * getMultiplierForUnit(unit);
};

function calculateTotalTaskOccuranceInYear(task) {
  return (52*(7 - (task.restrictions.tow === "weekends" ? 5:0) - (task.restrictions.tow === "weekdays" ? 2:0)) * 24 * 60) / frequencyInMinutes(task);
}

function calculateTotalTaskLengthInYear(task) {
  let totalLengthInYear =
    calculateTotalTaskOccuranceInYear(task) * task.restrictions.len;

  return totalLengthInYear;
}

function getTimeInMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return [hour, minute];
}

function getRandomWithPriority(array) {
  if (array.length === 0) {
    return null;
  }
  let normal = [...Array(5).keys()].map((f) => Math.random());
  normal =
    normal.reduce((a, b) => {
      a += b;
      return a;
    }, 0) / normal.length;
  normal = Math.abs(normal - 0.5);
  return array[Math.floor(normal * array.length)];
}
function getTimestampFromTime(time, baseDate) {
  baseDate = new Date(baseDate);
  const [hours, minutes] = time.split(":").map(Number);
  const timestampDate = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hours,
    minutes
  );
  return timestampDate.getTime();
}
const calculateLateTaskPriority = (task, currentTimestamp) => {
  const taskWindowEnd = getTimestampFromTime(
    task.restrictions.end,
    currentTimestamp
  );
  const timeDifference = taskWindowEnd - currentTimestamp;
  return Math.max(0, 1 - timeDifference / (24 * 60 * 60 * 1000)); // A higher value indicates higher priority for late tasks
};

const calculateFrequncyBasedPriority = (task) => {
  return Math.max(0, 1/frequencyInMinutes(task)); // A higher value indicates higher priority for more frequent tasks
};

const calculateTightWindowPriority = (task, currentTimestamp) => {
  const taskStart = getTimestampFromTime(
    task.restrictions.start,
    currentTimestamp
  );
  const taskEnd = getTimestampFromTime(task.restrictions.end, currentTimestamp);
  const taskDuration = taskEnd - taskStart;
  return Math.max(0, 1 - taskDuration / (24 * 60 * 60 * 1000)); // A higher value indicates higher priority for tasks with a tighter window
};

const taskAssignment = (tasks) => {
  const binLengthInMinutes = 5;
  const now = Math.round(Date.now() / (1000 * 60 * binLengthInMinutes)) * 1000 * 60 * binLengthInMinutes;
  const binLength = binLengthInMinutes*60*1000;
  const ticksInYear = 365 * 24 * 60 * 60 * 1000;

  //build bins
  const maxTaskLength = Math.max(...tasks.map(getTaskLengthInTicks))
  tasks.forEach((task) => {
    task.difficulty = calculateTaskDifficulty(task,maxTaskLength);
  });
  let bins = [];
  for (let i = now; i < now + ticksInYear; i += binLength) {
    bins.push({
      timestamp: i,
      task: null,
      timeofDay: getToDFromTimestamp(i).join(":"),
      difficulty: 0,
    });
  }

  // calculate the total difficulty level (if one have gzilion tasks, then this affects the threashhold where a task will be picked even if the difficulty is not 1) this will be the total amount of time one has / total amount of task lengths * frequncies
  const totalDifficulty =
    tasks.reduce((a, t) => {
      a += calculateTotalTaskLengthInYear(t);
      return a;
    }, 0) /
    (365 * (24 - 8) * 60); //8 hours for sleep
  // pick a task (we should check the current difficulty (I should think about the threashhold wher you can pick the task when difficulty is not 1 based on task length))
  let lastDone = tasks.reduce((a, t) => {
    a[t.id] = null;
    return a;
  }, {});

  let remainingMinutes = null;
  let currentDifficulty = 0;
  let acc = 0;
  for (let bin of bins){//.slice(100,450)) {
    if (remainingMinutes > 0) {
      remainingMinutes -= binLengthInMinutes;
    } else {
      const availableTasks = tasks.filter(
        (f) => (f.difficulty + currentDifficulty) <= 1 &&
          canDo(f, bin.timestamp) &&
          (lastDone[f.id] === null ||
            0.9 * frequencyInMinutes(f) * 60000 + lastDone[f.id] <
              bin.timestamp)
      );
      const lookAheadTasks = tasks.filter(
        (f) => 
          (canDo(f, bin.timestamp, true) ) &&
          (lastDone[f.id] === null ||
            0.9 * frequencyInMinutes(f) * 60000 + lastDone[f.id] <
              bin.timestamp)
      );
      availableTasks.sort((a, b) => {
        const priorityA =
          calculateLateTaskPriority(a, bin.timestamp) *
          calculateTightWindowPriority(a, bin.timestamp) *
          calculateFrequncyBasedPriority(a);
        const priorityB =
          calculateLateTaskPriority(b, bin.timestamp) *
          calculateTightWindowPriority(b, bin.timestamp)*
          calculateFrequncyBasedPriority(b);
        return priorityB - priorityA;
      });
      if(availableTasks.length>0 && lookAheadTasks.every(f=>(f.difficulty + currentDifficulty) <= 1)){
        const task = availableTasks[0]
        bin.task = task;
        remainingMinutes = task.restrictions.len - binLengthInMinutes;
        lastDone[task.id] = bin.timestamp;
        currentDifficulty += task.difficulty;
        acc = 0;
      } else {
        currentDifficulty = Math.max(0, currentDifficulty - acc);
        acc += 0.01;
      }
    }
    bin.difficulty = currentDifficulty;
  }

  let taskPlacmentResult = tasks.map(t=>{
    let occ = calculateTotalTaskOccuranceInYear(t);
    let res = bins.filter(f=>f.task?.id === t.id).length;
    return {desc:t.description, planned:Math.round(occ), actual:Math.round(res)}
  })

  return [bins.map((t) => ({
    id: t.task?.id,
    title: t.task?.description,
    start: new Date(t.timestamp),
    end: new Date(t.timestamp + t.task?.restrictions.len * 60 * 1000),
    difficulty: t.difficulty,
    ts: t.timestamp,
    summary: t.task?str(t.task):null
  })), taskPlacmentResult, totalDifficulty];
};
