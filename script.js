document.addEventListener("DOMContentLoaded", function () {
  const taskForm = document.getElementById("taskForm");
  const generateCalendarBtn = document.getElementById("generateCalendarBtn");

  function generateGuid() {
    if (
      typeof crypto !== "undefined" &&
      crypto.getRandomValues &&
      typeof Uint32Array !== "undefined"
    ) {
      // Use crypto API for better randomness if available
      let buf = new Uint32Array(4);
      crypto.getRandomValues(buf);
      return `${buf[0].toString(16).padStart(8, "0")}${buf[1]
        .toString(16)
        .padStart(8, "0")}-${buf[2].toString(16).padStart(8, "0")}-${buf[3]
        .toString(16)
        .padStart(8, "0")}`;
    } else {
      // Fallback to pseudo-random method if crypto API is not available
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }
      );
    }
  }

  function storeCookie(name, object, expirationDays = 365 * 10) {
    const serializedObject = JSON.stringify(object);
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expirationDays);
    const cookieValue = `${name}=${encodeURIComponent(
      serializedObject
    )}; expires=${expirationDate.toUTCString()}; path=/`;
    document.cookie = cookieValue;
  }

  function getCookie(name) {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const [cookieName, cookieValue] = cookie.split("=");
      if (cookieName.trim() === name) {
        const decodedCookieValue = decodeURIComponent(cookieValue);
        return JSON.parse(decodedCookieValue);
      }
    }
    return null;
  }

  function store(name, object) {
    localStorage.setItem("taskScheduler-"+name, JSON.stringify(object));
  }

  function get(name) {
    const item = localStorage.getItem("taskScheduler-"+name);
    if (!item) return null;
    return JSON.parse(item);
  }

  const tasksDom = document.getElementById("tasks");
  tasksDom.addEventListener("click", (event) => {
    const target = event.target;
    if (target.matches(".delete-button")) {
      const taskId = target.getAttribute("data-task-id");
      deleteTask(taskId);
    }
  });

  const getTimeAsNumber = (str)=>{
    return parseInt(str.split(":")[0])
  }
  function updateTaskDisplay(tasks) {
    tasksDom.innerHTML = tasks.sort((t,r)=>{
      if (getTimeAsNumber(t.restrictions.start) > getTimeAsNumber(r.restrictions.start)) return 1;
      if (getTimeAsNumber(t.restrictions.start) < getTimeAsNumber(r.restrictions.start)) return -1;
      if (getTimeAsNumber(t.restrictions.end) > getTimeAsNumber(r.restrictions.end)) return 1;
      if (getTimeAsNumber(t.restrictions.end) < getTimeAsNumber(r.restrictions.end)) return -1;
      return 0;
    })
      .map((task) => {
        const taskDetails = str(task);
        const taskHtml = `<li style="display:flex">${taskDetails}<p class="delete-button" data-task-id="${task.id}">X</p></li>`;
        return taskHtml;
      })
      .join("");
    if(document.getElementById("autoGenerate").checked){
      generateCalendar()
    }
  }

  function download(filename, text) {
    var pom = document.createElement("a");
    pom.setAttribute(
      "href",
      "data:text/calendar;charset=utf-8," + encodeURIComponent(text)
    );
    pom.setAttribute("download", filename);

    if (document.createEvent) {
      var event = document.createEvent("MouseEvents");
      event.initEvent("click", true, true);
      pom.dispatchEvent(event);
    } else {
      pom.click();
    }
  }

  window.downloadIcs = (events) => {
    var ics = buildIcs(events);
    download("taskScheduler.ics", ics);
  };

  var wrap = (s) => s.replaceAll(/(.{1,75})/g, "$1\n\t").trim();

  function pad(i) {
    return i < 10 ? `0${i}` : `${i}`;
  }

  var convertDate = (dateString) => {
    var date = new Date(dateString);
    var year = date.getUTCFullYear();
    var month = pad(date.getUTCMonth() + 1);
    var day = pad(date.getUTCDate());
    var hour = pad(date.getUTCHours());
    var minute = pad(date.getUTCMinutes());
    var second = pad(date.getUTCSeconds());
    return `${year}${month}${day}T${hour}${minute}${second}Z`;
  };

  var uuid = () => {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (
        c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
      ).toString(16)
    );
  };

  var buildIcsEvent = (event, ts) => {
    return [
      `BEGIN:VEVENT`,
      `UID:${uuid()}`,
      `SUMMARY:${event.title}`,
      `DTSTART:${convertDate(event.start)}`,
      `DTEND:${convertDate(event.end)}`,
      `DTSTAMP:${ts}`,
      `END:VEVENT`,
    ];
  };

  var buildIcs = (events) => {
    var ts = convertDate(new Date().toISOString());
    return [
      `BEGIN:VCALENDAR`,
      `VERSION:2.0`,
      `CALSCALE:GREGORIAN`,
      `PRODID:taskScheduler/ics`,
      `METHOD:PUBLISH`,
      `X-PUBLISHED-TTL:PT1H`,
      ...events.map((e) => buildIcsEvent(e, ts)),
      `END:VCALENDAR`,
    ]
      .flatMap((f) => f)
      .map(wrap)
      .join("\n");
  };

  const updateTaskInputwithTask = (task)=>{
    if(!task) return;
    document.getElementById("taskDescriptionInput").value = task.description;
    document.getElementById("taskFrequencyInput").value = task.frequency;
    document.getElementById("taskFrequencyUnit").value = task.unit;
    document.getElementById("taskLengthInput").value = task.restrictions.len;
    document.getElementById("taskTimeOfWeek").value = task.restrictions.tow;
    document.getElementById("taskStartTimeInput").value =
      task.restrictions.start;
    document.getElementById("taskEndTimeInput").value = task.restrictions.end;
  }

  function deleteTask(taskId) {
    task = tasks.find((f) => f.id && f.id === taskId);
    tasks = tasks.filter((f) => f.id && f.id !== taskId);
    store("tasks", tasks);
    updateTaskDisplay(tasks);
    updateTaskInputwithTask(task);
    
  }

  function generateCalendar() {
    document.getElementById("generateSpinner").style.display = "inline-block";
    const [events, result, totalDifficulty] = taskAssignment(tasks);
    document.getElementById("total-difficulty").innerHTML = ((Math.round(totalDifficulty*1000)/1000)*100).toFixed(2)+"%"
    let restasks = document.getElementById("result-tasks");
    restasks.innerHTML="";
    const unplannedTasks = result.filter(t=>(t.actual / t.planned)<0.9)
    unplannedTasks.forEach(t => {
      let el = document.createElement("li");
      el.innerHTML = t.desc+" / "+t.planned+" / "+t.actual;
      restasks.appendChild(el)
    });
    if(unplannedTasks.length > 0){
      document.getElementById("unplannedTasks").style.display = "block";
    } else {
      document.getElementById("unplannedTasks").style.display = "none";
    }
    var calendarEl = document.getElementById("calendar");
    var calendar = new FullCalendar.Calendar(calendarEl, {
      buttonText: {
        prev:     '<', // <
        next:     '>', // >
        today:    'T',
        month:    'M',
        week:     'W',
        day:      'D',
        list:     'L'
      },
      customButtons: {
        downloadIcs: {
          text: ".ics",
          click: function () {
            downloadIcs(events.filter((f) => f.id));
          },
        },
      },
      initialView: "dayGridMonth",
      themeSystem: "bootstrap5",
      fixedWeekCount: false,
      firstDay: 1,
      headerToolbar: {
        left: "prev,next today downloadIcs",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay listMonth",
      },
      events: events.filter((f) => f.id),
      eventClick: function (info) {
        alert(JSON.stringify(info.event.extendedProps.summary));
        info.el.style.backgroundColor = "gray";
      },
    });
    calendar.render();

    // Generate values
    const xValues = [];
    const yValues = [];
    for (let x = 0; x < events.length / (365/2); x += 1) {
      xValues.push(new Date(events[x].ts));
      yValues.push(events[x].difficulty);
    }

    // Display using Plotly
    const data = [
      {
        x: xValues,
        y: yValues,
        mode: "lines+markers",
        marker: {
          color: "rgb(17, 157, 255)",
          size: 3,
        },
      },
    ];
    const layout = { title: "Difficulty"};
    let plot = document.getElementById("plot");
    plot.style.display = "block";
    Plotly.newPlot(plot, data, layout);

    document.getElementById("result").style.display = "block";
    document.getElementById("generateSpinner").style.display = "none";
  }
  generateCalendarBtn.addEventListener("click", generateCalendar);

  let tasks = get("tasks") ?? [];
  updateTaskDisplay(tasks);
  updateTaskInputwithTask(getCookie("task"));
  generateCalendar() ;
  taskForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const taskDescriptionInput = document.getElementById(
      "taskDescriptionInput"
    );
    const taskFrequencyInput = document.getElementById("taskFrequencyInput");
    const taskFrequencyUnit = document.getElementById("taskFrequencyUnit");
    const taskLengthInput = document.getElementById("taskLengthInput");
    const taskTimeOfWeek = document.getElementById("taskTimeOfWeek");
    const taskStartTimeInput = document.getElementById("taskStartTimeInput");
    const taskEndTimeInput = document.getElementById("taskEndTimeInput");

    const task = {
      id: generateGuid(),
      description: taskDescriptionInput.value,
      frequency: parseInt(taskFrequencyInput.value),
      unit: taskFrequencyUnit.value,
      restrictions: {
        len: parseInt(taskLengthInput.value),
        tow: taskTimeOfWeek.value,
        start: taskStartTimeInput.value,
        end: taskEndTimeInput.value,
      },
    };

    tasks.push(task);
    store("tasks", tasks);
    storeCookie("task", task);
    updateTaskDisplay(tasks);
  });
});
